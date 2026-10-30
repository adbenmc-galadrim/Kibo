import { Database } from "bun:sqlite";
import { type ChangeMessage, CodeRequest, RpcRequest } from "@kibo/schema";
import type { Server, ServerWebSocket } from "bun";
import { readCookie, sameSecret } from "./auth";
import type { CodeService } from "./code/code-service";
import { fail, respond, unredacted } from "./http-response";
import { serveIcon } from "./icons/icon-route";
import type { IconStore } from "./icons/icon-store";
import { AGENT_MCP_PATH, handleAgentMcp } from "./project-agent/mcp-route";
import type { AgentMcpSink } from "./project-agent/types";
import {
  isQuestionImagePath,
  type QuestionImageRouteDeps,
  serveQuestionImage,
} from "./questions/image-route";
import { dispatchRpc, type RpcContext, type RpcExtension, type RpcHandler } from "./rpc-extensions";
import { rpcRefusal } from "./rpc-refusal";
import { type HookSink, handleHook } from "./runs/hook-route";
import type { Service } from "./service";
import { SESSION_COOKIE, sessionCookie } from "./sessions/cookie";
import { deviceNameFromUserAgent } from "./sessions/device-name";
import { readPairingField } from "./sessions/pairing-body";
import { sessionRpc } from "./sessions/rpc";
import { openSessionStore, type SessionCheck, type SessionStore } from "./sessions/session-store";
import { serveUi } from "./ui-route";

export type ServerOptions = {
  service: Service;
  token: string;
  port: number;
  uiDir: string | null;
  extraOrigins?: string[];
  hooks?: HookSink;
  agentMcp?: AgentMcpSink;
  code?: CodeService;
  icons?: Pick<IconStore, "get">;
  questionImages?: Pick<QuestionImageRouteDeps, "read">;
  sandboxOrigin?: () => string | null;
  redact?: (text: string) => string;
  sessions?: SessionStore;
  extensions?: RpcExtension[];
  handlers?: RpcHandler[];
  now?: () => number;
};
type WsData = { sessionHash: string };
export type RunningServer = { url: string; port: number; stop(): void };

const MAX_BODY_BYTES = 3 * 1_048_576;
const HOOK_PATH = /^\/hooks\/([0-9a-f-]{36})$/;

const sandboxOrigins = (origin: string | null): string[] => {
  if (origin === null || !URL.canParse(origin)) return [];
  const { port } = new URL(origin);
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
};

function sessionStoreOf(given: SessionStore | undefined): { sessions: SessionStore; close(): void } {
  if (given) return { sessions: given, close: () => {} };
  const db = new Database(":memory:", { strict: true });
  return { sessions: openSessionStore(db), close: () => db.close() };
}

const HEALTH_HEADERS = { "cache-control": "no-store" };

async function noStore(handle: (() => Promise<Response>) | null): Promise<Response> {
  const res = handle ? await handle() : new Response("not found", { status: 404 });
  res.headers.set("cache-control", "no-store");
  return res;
}

function healthResponse(method: string): Response {
  if (method !== "GET") return new Response("not found", { status: 404 });
  return Response.json({ pid: process.pid }, { headers: HEALTH_HEADERS });
}

export function startServer(opts: ServerOptions): RunningServer {
  const now = opts.now ?? Date.now;
  const { sessions, close: closeSessions } = sessionStoreOf(opts.sessions);
  sessions.purge(now());
  const sockets = new Map<string, Set<ServerWebSocket<WsData>>>();
  const redact = opts.redact ?? unredacted;
  let port = opts.port;
  const hosts = () => [`127.0.0.1:${port}`, `localhost:${port}`];
  const origins = () => {
    const sandbox = sandboxOrigins(opts.sandboxOrigin?.() ?? null);
    const extra = (opts.extraOrigins ?? []).filter((o) => !sandbox.includes(o));
    return [`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...extra];
  };
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

  const paired = (req: Request) => {
    const deviceName = deviceNameFromUserAgent(req.headers.get("user-agent"));
    const { id } = sessions.create({ deviceName, remote: false }, now());
    return new Response(null, { status: 204, headers: { "set-cookie": sessionCookie(id, false) } });
  };

  const pairWithToken = async (req: Request) => {
    const token = await readPairingField(req, "token");
    if (token.tooLarge) return fail("TOO_LARGE", "pairing body too large", 413);
    if (token.value === null || !sameSecret(token.value, opts.token)) {
      return fail("UNAUTHORIZED", "invalid pairing token", 401);
    }
    return paired(req);
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

  const handleApi = async (req: Request, url: URL, srv: Server<WsData>): Promise<Response | undefined> => {
    if (!origins().includes(req.headers.get("origin") ?? ""))
      return fail("FORBIDDEN", "origin not allowed", 403);
    if (url.pathname === "/api/pair" && req.method === "POST") return pairWithToken(req);
    const session = sessionOf(req);
    const id = sessionIdOf(req);
    if (!session || id === null) return fail("UNAUTHORIZED", "pair this browser first", 401);
    const ctx: RpcContext = { sessionHash: session.hash, remote: false };
    const renewal = session.renewed ? sessionCookie(id, false) : null;
    const res = await authenticated(req, url, srv, ctx, renewal);
    if (res && renewal) res.headers.set("set-cookie", renewal);
    return res;
  };

  const fetchHandler = async (req: Request, srv: Server<WsData>): Promise<Response | undefined> => {
    const url = new URL(req.url);
    if (!hosts().includes(req.headers.get("host") ?? ""))
      return new Response("forbidden host", { status: 403 });
    if (url.pathname === "/api/health") return healthResponse(req.method);
    const hookRun = HOOK_PATH.exec(url.pathname)?.[1];
    const hooks = opts.hooks;
    if (hookRun) return noStore(hooks ? () => handleHook(req, hookRun, hooks) : null);
    const agentRun = AGENT_MCP_PATH.exec(url.pathname)?.[1];
    const agentMcp = opts.agentMcp;
    if (agentRun) return noStore(agentMcp ? () => handleAgentMcp(req, agentRun, agentMcp) : null);
    if (url.pathname.startsWith("/icons/")) {
      return serveIcon(req, url, { icons: opts.icons ?? { get: () => null }, origins, hasSession });
    }
    if (isQuestionImagePath(url.pathname)) {
      const read = opts.questionImages?.read ?? (() => null);
      return serveQuestionImage(req, url, { read, origins, hasSession });
    }
    if (!url.pathname.startsWith("/api/")) {
      return serveUi(opts.uiDir, url.pathname, opts.sandboxOrigin?.() ?? null);
    }
    const res = await handleApi(req, url, srv);
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

  const local = Bun.serve<WsData>({
    hostname: "127.0.0.1",
    port: opts.port,
    maxRequestBodySize: MAX_BODY_BYTES,
    fetch: fetchHandler,
    websocket,
  });
  port = local.port ?? opts.port;

  const publish = (message: ChangeMessage) => {
    const text = redact(JSON.stringify(message));
    local.publish("changes", text);
  };
  const off = opts.service.onChange(publish);
  const offCode = opts.code?.onChange(publish);
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stop: () => {
      off();
      offCode?.();
      offRevoke();
      local.stop(true);
      closeSessions();
    },
  };
}
