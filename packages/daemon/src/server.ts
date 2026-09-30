import { Database } from "bun:sqlite";
import { type ChangeMessage, CodeRequest, KiboError, RpcRequest } from "@kibo/schema";
import type { Server, ServerWebSocket } from "bun";
import { type HookSink, handleHook } from "./agents/hook-route";
import { readCookie, sameSecret } from "./auth";
import type { CodeService } from "./code/code-service";
import type { AssetLookup } from "./components/sandbox-server";
import { serveTrusted } from "./components/trusted-route";
import { fail, respond, unredacted } from "./http-response";
import { serveIcon } from "./icons/icon-route";
import type { IconStore } from "./icons/icon-store";
import { PairingCodes } from "./remote/pairing-codes";
import type { RemoteListen } from "./remote/remote-access";
import { dispatchRpc, type RpcContext, type RpcExtension, type RpcHandler } from "./rpc-extensions";
import { rpcRefusal } from "./rpc-refusal";
import type { Service } from "./service";
import { SESSION_COOKIE, sessionCookie } from "./sessions/cookie";
import { deviceNameFromUserAgent } from "./sessions/device-name";
import { sessionRpc } from "./sessions/rpc";
import { openSessionStore, type SessionCheck, type SessionStore } from "./sessions/session-store";
import { serveUi, withUiHeaders } from "./ui-route";

export type ServerOptions = {
  service: Service;
  token: string;
  port: number;
  uiDir: string | null;
  extraOrigins?: string[];
  hooks?: HookSink;
  code?: CodeService;
  assets?: AssetLookup;
  icons?: Pick<IconStore, "get">;
  sandboxOrigin?: () => string | null;
  redact?: (text: string) => string;
  sessions?: SessionStore;
  pairingCodes?: PairingCodes;
  extensions?: RpcExtension[];
  handlers?: RpcHandler[];
  now?: () => number;
};
type WsData = { sessionHash: string };
export type ListenInfo = { hostname: string; port: number; secure: boolean; remote: boolean };
export type RunningServer = { url: string; port: number; stop(): void; listenRemote: RemoteListen };

const MAX_BODY_BYTES = 1_048_576;
const HOOK_PATH = /^\/hooks\/([0-9a-f-]{36})$/;

const sandboxOrigins = (origin: string | null): string[] => {
  if (origin === null || !URL.canParse(origin)) return [];
  const { port } = new URL(origin);
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
};
const hostPart = (hostname: string, port: number) =>
  `${hostname.includes(":") ? `[${hostname}]` : hostname}:${port}`;

function sessionStoreOf(given: SessionStore | undefined): { sessions: SessionStore; close(): void } {
  if (given) return { sessions: given, close: () => {} };
  const db = new Database(":memory:", { strict: true });
  return { sessions: openSessionStore(db), close: () => db.close() };
}

export function startServer(opts: ServerOptions): RunningServer {
  const now = opts.now ?? Date.now;
  const { sessions, close: closeSessions } = sessionStoreOf(opts.sessions);
  sessions.purge(now());
  const pairingCodes = opts.pairingCodes ?? new PairingCodes(now);
  const sockets = new Map<string, Set<ServerWebSocket<WsData>>>();
  const redact = opts.redact ?? unredacted;
  let port = opts.port;
  const hosts = () => [`127.0.0.1:${port}`, `localhost:${port}`];
  const origins = () => {
    const sandbox = sandboxOrigins(opts.sandboxOrigin?.() ?? null);
    const extra = (opts.extraOrigins ?? []).filter((o) => !sandbox.includes(o));
    return [`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...extra];
  };
  const allowedHosts = (l: ListenInfo) => (l.remote ? [hostPart(l.hostname, l.port)] : hosts());
  const allowedOrigins = (l: ListenInfo) =>
    l.remote ? [`https://${hostPart(l.hostname, l.port)}`] : origins();
  const sessionIdOf = (req: Request) => readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  const sessionOf = (req: Request): SessionCheck | null => {
    const id = sessionIdOf(req);
    return id === null ? null : sessions.validate(id, now());
  };
  const hasSession = (req: Request) => sessionOf(req) !== null;
  const offRevoke = sessions.onRevoke((hash) => {
    for (const ws of sockets.get(hash) ?? []) ws.close(4401, "session revoked");
    sockets.delete(hash);
  });
  const extensions: RpcExtension[] = [
    sessionRpc(sessions, (m) => opts.service.docs.emit(m), now),
    ...(opts.extensions ?? []),
  ];
  const handlers = opts.handlers ?? [];

  const paired = (req: Request, l: ListenInfo) => {
    const deviceName = deviceNameFromUserAgent(req.headers.get("user-agent"));
    const { id } = sessions.create({ deviceName, remote: l.remote }, now());
    return new Response(null, { status: 204, headers: { "set-cookie": sessionCookie(id, l.secure) } });
  };

  const pairWithToken = async (req: Request, l: ListenInfo) => {
    if (l.remote) return fail("FORBIDDEN", "token pairing is only allowed on 127.0.0.1", 403);
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    if (typeof body?.token !== "string" || !sameSecret(body.token, opts.token)) {
      return fail("UNAUTHORIZED", "invalid pairing token", 401);
    }
    return paired(req, l);
  };

  const pairWithCode = async (req: Request, l: ListenInfo) => {
    const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
    const outcome = typeof body?.code === "string" ? pairingCodes.redeem(body.code) : "invalid";
    if (outcome === "rate-limited") return fail("RATE_LIMITED", "too many attempts, create a new code", 429);
    if (outcome === "invalid") return fail("UNAUTHORIZED", "invalid or expired code", 401);
    return paired(req, l);
  };

  const authenticated = async (
    req: Request,
    url: URL,
    srv: Server<WsData>,
    ctx: RpcContext,
    renewal: string | null,
  ): Promise<Response | undefined> => {
    if (url.pathname === "/api/events") {
      const data = { sessionHash: ctx.sessionHash };
      const upgraded = renewal
        ? srv.upgrade(req, { data, headers: { "set-cookie": renewal } })
        : srv.upgrade(req, { data });
      return upgraded ? undefined : new Response("upgrade failed", { status: 400 });
    }
    if (url.pathname === "/api/rpc" && req.method === "POST") {
      const parsed = RpcRequest.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return fail("INVALID_INPUT", rpcRefusal(parsed.error), 400);
      const rpc = parsed.data;
      return respond(() => dispatchRpc(opts.service, extensions, rpc, ctx, handlers), redact);
    }
    if (url.pathname === "/api/code" && req.method === "POST" && opts.code) {
      const code = opts.code;
      const parsed = CodeRequest.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return fail("INVALID_INPUT", parsed.error.message, 400);
      return respond(() => code.handle(parsed.data, ctx), redact);
    }
    return new Response("not found", { status: 404 });
  };

  const handleApi = async (
    req: Request,
    url: URL,
    srv: Server<WsData>,
    l: ListenInfo,
  ): Promise<Response | undefined> => {
    if (!allowedOrigins(l).includes(req.headers.get("origin") ?? ""))
      return fail("FORBIDDEN", "origin not allowed", 403);
    if (url.pathname === "/api/pair" && req.method === "POST") return pairWithToken(req, l);
    if (url.pathname === "/api/pair-code" && req.method === "POST") return pairWithCode(req, l);
    const session = sessionOf(req);
    const id = sessionIdOf(req);
    if (!session || id === null) return fail("UNAUTHORIZED", "pair this browser first", 401);
    const ctx: RpcContext = { sessionHash: session.hash, remote: session.remote || l.remote };
    const renewal = session.renewed ? sessionCookie(id, l.secure) : null;
    const res = await authenticated(req, url, srv, ctx, renewal);
    if (res && renewal) res.headers.set("set-cookie", renewal);
    return res;
  };

  const makeFetch =
    (listen: () => ListenInfo) =>
    async (req: Request, srv: Server<WsData>): Promise<Response | undefined> => {
      const l = listen();
      const url = new URL(req.url);
      if (!allowedHosts(l).includes(req.headers.get("host") ?? ""))
        return new Response("forbidden host", { status: 403 });
      const hookRun = HOOK_PATH.exec(url.pathname)?.[1];
      if (hookRun) {
        const res =
          opts.hooks && !l.remote
            ? await handleHook(req, hookRun, opts.hooks)
            : new Response("not found", { status: 404 });
        res.headers.set("cache-control", "no-store");
        return res;
      }
      if (url.pathname.startsWith("/components/")) {
        return serveTrusted(req, url, { assets: opts.assets, origins: () => allowedOrigins(l), hasSession });
      }
      if (url.pathname.startsWith("/icons/")) {
        return serveIcon(req, url, {
          icons: opts.icons ?? { get: () => null },
          origins: () => allowedOrigins(l),
          hasSession,
        });
      }
      if (!url.pathname.startsWith("/api/")) {
        return withUiHeaders(serveUi(opts.uiDir, url.pathname), opts.sandboxOrigin?.() ?? null);
      }
      const res = await handleApi(req, url, srv, l);
      res?.headers.set("cache-control", "no-store");
      return res;
    };

  const websocket = {
    open(ws: ServerWebSocket<WsData>) {
      if (!sessions.isActive(ws.data.sessionHash, now())) {
        ws.close(4401, "session revoked");
        return;
      }
      ws.subscribe("changes");
      const set = sockets.get(ws.data.sessionHash) ?? new Set();
      set.add(ws);
      sockets.set(ws.data.sessionHash, set);
    },
    close(ws: ServerWebSocket<WsData>) {
      sockets.get(ws.data.sessionHash)?.delete(ws);
    },
    message() {},
  };

  const servers = new Set<Server<WsData>>();
  const local = Bun.serve<WsData>({
    hostname: "127.0.0.1",
    port: opts.port,
    maxRequestBodySize: MAX_BODY_BYTES,
    fetch: makeFetch(() => ({ hostname: "127.0.0.1", port, secure: false, remote: false })),
    websocket,
  });
  port = local.port ?? opts.port;
  servers.add(local);

  const listenRemote: RemoteListen = ({ hostname, port: remotePort, tls }) => {
    if (!tls.cert || !tls.key) throw new KiboError("TLS_REQUIRED", "remote access requires TLS");
    const info: ListenInfo = { hostname, port: remotePort, secure: true, remote: true };
    const remote = Bun.serve<WsData>({
      hostname,
      port: remotePort,
      tls,
      maxRequestBodySize: MAX_BODY_BYTES,
      fetch: makeFetch(() => info),
      websocket,
    });
    info.port = remote.port ?? remotePort;
    servers.add(remote);
    return {
      port: info.port,
      stop: () => {
        servers.delete(remote);
        remote.stop(true);
      },
    };
  };

  const publish = (message: ChangeMessage) => {
    const text = redact(JSON.stringify(message));
    for (const s of servers) s.publish("changes", text);
  };
  const off = opts.service.onChange(publish);
  const offCode = opts.code?.onChange(publish);
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    listenRemote,
    stop: () => {
      off();
      offCode?.();
      offRevoke();
      for (const s of servers) s.stop(true);
      servers.clear();
      closeSessions();
    },
  };
}
