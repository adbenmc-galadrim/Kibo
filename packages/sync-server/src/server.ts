import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { JoinRequest, KiboError, type KiboErrorCode, MAX_FRAME_BYTES, SYNC_LIMITS } from "@kibo/schema";
import { KPKG_MAX_RAW_BYTES } from "@kibo/trust";
import type { Server } from "bun";
import { redeemDeviceInvite } from "./accounts";
import { openServerDb, type ServerDb } from "./db";
import { type HubConnection, SyncHub } from "./hub";
import { readBoundedBody } from "./market/bounded-body";
import { createMarketLimits } from "./market/market-limits";
import { handleMarketRoute } from "./market/routes";
import { NONCE_TTL_MS, NonceCache } from "./market/signed-request";
import { TeamMarket } from "./market/team-market";
import { publicErrorMessage } from "./public-error";
import { RoomRegistry } from "./rooms";

export type SyncServerOptions = {
  dataDir: string;
  hostname: string;
  port: number;
  origin: string;
  tls: { cert: string; key: string } | null;
  behindProxy: boolean;
  now?: () => number;
  authTimeoutMs?: number;
};

type WsData = { id: string; ip: string };

export const JOIN_MAX_BYTES = 4096;
export const MAX_REQUEST_BYTES = Math.max(MAX_FRAME_BYTES, KPKG_MAX_RAW_BYTES);
const REVOCATION_CHECK_MS = 5_000;
const SWEEP_MS = 60_000;
export const UNAUTHENTICATED_PER_IP = 32;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const JOIN_STATUS: Partial<Record<KiboErrorCode, number>> = {
  INVITE_INVALID: 403,
  INVALID_INPUT: 400,
  TOO_LARGE: 413,
  RATE_LIMITED: 429,
};

const fail = (code: KiboErrorCode) =>
  Response.json(
    { ok: false, error: { code, message: publicErrorMessage(code) } },
    { status: JOIN_STATUS[code] ?? 400, headers: { "cache-control": "no-store" } },
  );

async function readJoinRequest(req: Request): Promise<JoinRequest> {
  const body = await readBoundedBody(req, JOIN_MAX_BYTES);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `join body is not JSON: ${String(e)}`);
  }
  const parsed = JoinRequest.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  return parsed.data;
}

function lastForwarded(req: Request): string | null {
  const hops = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  const last = hops.at(-1)?.trim();
  return last ? last : null;
}

export async function startSyncServer(opts: SyncServerOptions): Promise<{
  url: string;
  port: number;
  hub: SyncHub;
  sdb: ServerDb;
  stop(): Promise<void>;
}> {
  const now = opts.now ?? Date.now;
  const loopback = LOOPBACK.has(opts.hostname);
  if (!loopback && (opts.tls === null || opts.behindProxy)) {
    throw new KiboError(
      "TLS_REQUIRED",
      `listening on ${opts.hostname} needs TLS; --behind-proxy only on loopback`,
    );
  }
  if ((!loopback || opts.behindProxy) && !opts.origin) {
    throw new KiboError("INVALID_INPUT", "--origin is required outside loopback or behind a proxy");
  }
  mkdirSync(opts.dataDir, { recursive: true, mode: 0o700 });
  chmodSync(opts.dataDir, 0o700);
  const sdb = openServerDb(join(opts.dataDir, "sync.db"));
  const rooms = new RoomRegistry(sdb, { now, unloadAfterMs: SYNC_LIMITS.unloadAfterMs });
  const market = await TeamMarket.open(sdb, opts.dataDir);
  const nonces = new NonceCache({ sdb, ttlMs: NONCE_TTL_MS, now });
  const marketLimits = createMarketLimits(now);
  const conns = new Map<string, HubConnection>();
  let hub: SyncHub | null = null;
  const requireHub = (): SyncHub => {
    if (!hub) throw new KiboError("INTERNAL", "sync hub is not ready");
    return hub;
  };
  const clientIp = (req: Request, srv: Server<WsData>): string | null =>
    opts.behindProxy ? lastForwarded(req) : (srv.requestIP(req)?.address ?? "unknown");

  const joinRoute = async (req: Request, ip: string, h: SyncHub): Promise<Response> => {
    if (h.failures.blocked(ip)) return fail("RATE_LIMITED");
    try {
      return Response.json(
        { ok: true, result: await redeemDeviceInvite(sdb, await readJoinRequest(req), now()) },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (e) {
      if (!(e instanceof KiboError)) {
        console.error("[kibo-sync] join failed", e);
        return Response.json(
          { ok: false, error: { code: "INTERNAL", message: "internal error" } },
          { status: 500 },
        );
      }
      if (e.code === "INVITE_INVALID") h.failures.fail(ip);
      return fail(e.code);
    }
  };

  const server = Bun.serve({
    hostname: opts.hostname,
    port: opts.port,
    tls: opts.tls ? { cert: opts.tls.cert, key: opts.tls.key } : undefined,
    maxRequestBodySize: MAX_REQUEST_BYTES,
    async fetch(req, srv) {
      const url = new URL(req.url);
      const h = requireHub();
      const ip = clientIp(req, srv);
      if (ip === null) return new Response("missing x-forwarded-for", { status: 400 });
      if (url.pathname === "/v1/sync") {
        if (h.failures.blocked(ip)) return new Response("too many failures", { status: 429 });
        if (h.unauthenticated(ip) >= UNAUTHENTICATED_PER_IP) {
          return new Response("too many pending connections", { status: 429 });
        }
        return srv.upgrade(req, { data: { id: crypto.randomUUID(), ip } })
          ? undefined
          : new Response("websocket upgrade required", { status: 426 });
      }
      if (url.pathname === "/v1/join" && req.method === "POST") return joinRoute(req, ip, h);
      if (market) {
        const res = await handleMarketRoute(req, url, { sdb, market, nonces, now, limits: marketLimits, ip });
        if (res) return res;
      }
      return new Response("not found", { status: 404 });
    },
    websocket: {
      data: {} as WsData,
      maxPayloadLength: MAX_FRAME_BYTES,
      open(ws) {
        const conn: HubConnection = {
          id: ws.data.id,
          ip: ws.data.ip,
          send: (frame) => ws.send(JSON.stringify(frame)),
          close: (code, reason) => ws.close(code, reason),
        };
        conns.set(conn.id, conn);
        requireHub().open(conn);
      },
      message(ws, message) {
        const conn = conns.get(ws.data.id);
        if (!conn) return;
        if (typeof message !== "string") {
          ws.close(1003, "text frames only");
          return;
        }
        requireHub()
          .message(conn, message)
          .catch((e: unknown) => console.error("[kibo-sync] message handling failed", conn.id, e));
      },
      close(ws) {
        const conn = conns.get(ws.data.id);
        if (!conn) return;
        conns.delete(conn.id);
        requireHub().closed(conn);
      },
    },
  });
  const port = server.port ?? opts.port;
  const origin = opts.origin || `${opts.tls ? "wss" : "ws"}://${opts.hostname}:${port}`;
  hub = new SyncHub({ sdb, rooms, origin, now, authTimeoutMs: opts.authTimeoutMs });
  const sweep = setInterval(() => rooms.sweep(), SWEEP_MS);
  const revocations = setInterval(() => requireHub().checkRevocations(), REVOCATION_CHECK_MS);
  sweep.unref();
  revocations.unref();
  return {
    url: `${opts.tls ? "https" : "http"}://${opts.hostname}:${port}`,
    port,
    hub,
    sdb,
    stop: async () => {
      clearInterval(sweep);
      clearInterval(revocations);
      await server.stop(true);
      sdb.close();
    },
  };
}
