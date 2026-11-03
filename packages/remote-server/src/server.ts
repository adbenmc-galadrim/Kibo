import type { Database } from "bun:sqlite";
import { REQUEST_TIMEOUT_MS, SNAPSHOT_MAX_BYTES } from "@kibo/remote/protocol";
import type { Server, ServerWebSocket } from "bun";
import { bearerOf, createAccount } from "./account";
import { openDb } from "./db";
import { fail, handled, readJson } from "./http";
import { CLOSE_UNAUTHORIZED, createMacChannel } from "./mac-socket";
import { createPairTokens } from "./pair-tokens";
import { createPhoneHub } from "./phone-hub";
import { phoneRoute } from "./phone-routes";
import { revokePhone } from "./phone-sessions";
import { createRelay } from "./relay";
import { createSnapshotStore } from "./snapshots";
import { serveStatic } from "./static";
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

export function serveRemote(db: Database, opts: Omit<RemoteServerOptions, "db">): RemoteServer {
  const now = opts.now ?? Date.now;
  const snapshots = createSnapshotStore(db, { now, maxTotalBytes: opts.maxTotalBytes });
  const pairTokens = createPairTokens(db, now);
  const account = createAccount(db, opts.setupCode, now);
  const phones = createPhoneHub<WsData>();
  const revoke = () => {
    revokePhone(db);
    phones.closeAll(CLOSE_UNAUTHORIZED, "phone revoked");
  };
  const relay = createRelay({
    deliver: (message) => mac.deliver(message),
    timeoutMs: opts.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
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
    const result = account.register(await readJson(req));
    mac.disconnect(CLOSE_UNAUTHORIZED, "mac token replaced");
    revoke();
    return Response.json(result);
  };

  const macUpgrade = (req: Request, server: Server<WsData>) => {
    const token = bearerOf(req);
    if (!token || !account.isMacToken(token)) return fail("UNAUTHORIZED", "mac token required");
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
        db,
        snapshots,
        relay,
        now,
        upgradeEvents: (upgrade) => server.upgrade(upgrade, { data: { role: "phone" } }),
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
    return serveStatic(opts.staticDir, url.pathname);
  };

  const websocket = {
    maxPayloadLength: MAX_PAYLOAD_BYTES,
    open(ws: ServerWebSocket<WsData>) {
      if (ws.data.role === "mac") return mac.open(ws);
      phones.add(ws);
      ws.send(JSON.stringify(mac.presence()));
    },
    message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
      if (ws.data.role === "mac") mac.message(ws, raw);
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
