import type { Database } from "bun:sqlite";
import { REQUEST_TIMEOUT_MS, SNAPSHOT_MAX_BYTES } from "@kibo/remote/protocol";
import type { Server, ServerWebSocket } from "bun";
import { assertSetupCode, bearerOf, createAccount } from "./account";
import { createChallenges } from "./challenges";
import { openDb } from "./db";
import { fail, handled, readJson } from "./http";
import { CLOSE_UNAUTHORIZED, createMacChannel } from "./mac-socket";
import { createPairTokens } from "./pair-tokens";
import { createPasskeys } from "./passkeys";
import { createPhoneHub } from "./phone-hub";
import { phoneRoute } from "./phone-routes";
import { revokePhone } from "./phone-sessions";
import { createRateLimit, LOGIN_OPTIONS_POLICY } from "./rate-limit";
import { createRelay } from "./relay";
import { createSnapshotStore } from "./snapshots";
import { createStatic } from "./static";
import { createWebauthn } from "./webauthn";
import type { WebauthnPort } from "./webauthn-port";

export type RemoteServerOptions = {
  port: number;
  db: string;
  origin: string;
  rpId: string;
  setupCode: string;
  staticDir: string | null;
  webauthn?: WebauthnPort;
  now?: () => number;
  hostname?: string;
  requestTimeoutMs?: number;
  maxTotalBytes?: number;
};

type RemoteServer = { url: string; port: number; stop(): Promise<void> };

type WsData = { role: "mac" } | { role: "phone" };

const MAX_PAYLOAD_BYTES = 2 * SNAPSHOT_MAX_BYTES;
const REGISTER_MAX_BYTES = 4_096;
const MAX_IDLE_SECONDS = 255;
const IDLE_MARGIN_SECONDS = 5;
const CLOSE_POLICY = 1008;

export const idleSeconds = (timeoutMs: number) =>
  Math.min(MAX_IDLE_SECONDS, Math.ceil(timeoutMs / 1_000) + IDLE_MARGIN_SECONDS);

export function serveRemote(db: Database, opts: Omit<RemoteServerOptions, "db">): RemoteServer {
  const now = opts.now ?? Date.now;
  const timeoutMs = opts.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const serveStatic = createStatic(opts.staticDir);
  const snapshots = createSnapshotStore(db, { now, maxTotalBytes: opts.maxTotalBytes });
  const pairTokens = createPairTokens(db, now);
  const account = createAccount(db, opts.setupCode, now);
  const phones = createPhoneHub<WsData>();
  const auth = {
    db,
    now,
    account,
    pairTokens,
    loginLimit: createRateLimit(db, "login-options", LOGIN_OPTIONS_POLICY, now),
    passkeys: createPasskeys(db, now),
    challenges: createChallenges(db, now),
    webauthn: opts.webauthn ?? createWebauthn({ rpId: opts.rpId, origin: opts.origin }),
  };
  const revoke = () => {
    revokePhone(db);
    phones.closeAll(CLOSE_UNAUTHORIZED, "phone revoked");
  };
  const relay = createRelay({
    deliver: (message) => mac.deliver(message),
    timeoutMs,
  });
  const mac = createMacChannel<WsData>({
    db,
    snapshots,
    pairTokens,
    relay,
    broadcast: phones.broadcast,
    revokePhone: revoke,
    now,
  });
  const register = async (req: Request) => {
    const result = account.register(await readJson(req, REGISTER_MAX_BYTES));
    mac.disconnect(CLOSE_UNAUTHORIZED, "mac token replaced");
    revoke();
    return Response.json(result);
  };

  const macUpgrade = (req: Request, server: Server<WsData>) => {
    account.authenticateMac(bearerOf(req));
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket")
      return new Response("upgrade required", { status: 426 });
    return server.upgrade(req, { data: { role: "mac" } })
      ? undefined
      : fail("INVALID_INPUT", "upgrade failed");
  };

  const api = async (req: Request, url: URL, server: Server<WsData>): Promise<Response | undefined> => {
    const route = `${req.method} ${url.pathname}`;
    if (route === "GET /api/health")
      return Response.json({ ok: true, mac: mac.presence().online ? "online" : "offline" });
    if (route === "POST /api/mac/register") return register(req);
    if (url.pathname === "/api/mac") return macUpgrade(req, server);
    if (url.pathname.startsWith("/api/phone/"))
      return phoneRoute(req, url, {
        ...auth,
        snapshots,
        relay,
        origin: opts.origin,
        upgradeEvents: (upgrade, headers) =>
          server.upgrade(upgrade, { headers: new Headers(headers), data: { role: "phone" } }),
      });
    return fail("NOT_FOUND", "unknown route");
  };

  const fetch = async (req: Request, server: Server<WsData>): Promise<Response | undefined> => {
    const url = new URL(req.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const res = await handled(() => api(req, url, server));
      res?.headers.set("cache-control", "no-store");
      return res;
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      return new Response("method not allowed", { status: 405 });
    return serveStatic(url.pathname);
  };

  const websocket = {
    maxPayloadLength: MAX_PAYLOAD_BYTES,
    open(ws: ServerWebSocket<WsData>) {
      if (ws.data.role === "mac") return mac.open(ws);
      phones.add(ws);
      ws.send(JSON.stringify(mac.presence()));
    },
    message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
      if (ws.data.role === "mac") return mac.message(ws, raw);
      ws.close(CLOSE_POLICY, "phones only listen");
    },
    close(ws: ServerWebSocket<WsData>) {
      if (ws.data.role === "mac") return mac.close(ws);
      phones.remove(ws);
    },
  };

  const server = Bun.serve<WsData>({
    hostname: opts.hostname ?? "0.0.0.0",
    port: opts.port,
    maxRequestBodySize: MAX_PAYLOAD_BYTES,
    idleTimeout: idleSeconds(timeoutMs),
    fetch,
    websocket,
  });
  const port = server.port ?? opts.port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stop: async () => {
      relay.failAll();
      await server.stop(true);
    },
  };
}

export async function startRemoteServer(opts: RemoteServerOptions): Promise<RemoteServer> {
  assertSetupCode(opts.setupCode);
  const db = openDb(opts.db);
  const server = serveRemote(db, opts);
  return {
    ...server,
    stop: async () => {
      await server.stop();
      db.close();
    },
  };
}
