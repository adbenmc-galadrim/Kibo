import { statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import {
  type ChangeMessage,
  CodeRequest,
  KiboError,
  type KiboErrorCode,
  RpcRequest,
  type RpcResponse,
} from "@kibo/schema";
import type { Server } from "bun";
import { type HookSink, handleHook } from "./agents/hook-route";
import { newSessionId, readCookie, sameSecret } from "./auth";
import type { CodeService } from "./code/code-service";
import type { AssetLookup } from "./components/sandbox-server";
import { serveTrusted } from "./components/trusted-route";
import { rpcRefusal } from "./rpc-refusal";
import type { Service } from "./service";

export type ServerOptions = {
  service: Service;
  token: string;
  port: number;
  uiDir: string | null;
  extraOrigins?: string[];
  hooks?: HookSink;
  code?: CodeService;
  assets?: AssetLookup;
  sandboxOrigin?: () => string | null;
  redact?: (text: string) => string;
};

const COOKIE = "kibo_session";
const MAX_BODY_BYTES = 1_048_576;
const STATUS: Partial<Record<KiboErrorCode, number>> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PROFILE_IN_USE: 409,
  INVALID_TRANSITION: 409,
  GIT_PUSHED: 409,
  GIT_STALE: 409,
  GIT_BUSY: 409,
  FILE_CHANGED: 409,
  PATH_OUTSIDE_PROJECT: 403,
  TOO_LARGE: 413,
  GH_UNAVAILABLE: 502,
  GH_FAILED: 502,
  TRUST_REQUIRED: 403,
  PERMISSION_DENIED: 403,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  COMPONENT_CRASHED: 502,
  HASH_MISMATCH: 409,
  VERSION_EXISTS: 409,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  MIGRATION_FAILED: 422,
  QUOTA_EXCEEDED: 413,
  SANDBOX_UNAVAILABLE: 503,
  SECRET_STORE_UNAVAILABLE: 503,
  NOT_CONNECTED: 409,
  REMOTE_UNAVAILABLE: 502,
  REMOTE_REJECTED: 502,
  REMOTE_NOT_FOUND: 404,
  REMOTE_CONFLICT: 409,
  MCP_UNAVAILABLE: 502,
  MCP_FAILED: 502,
  AI_UNAVAILABLE: 503,
};
const HIDDEN = new Set<KiboErrorCode>(["INTERNAL", "STORE_CORRUPT"]);
const HOOK_PATH = /^\/hooks\/([0-9a-f-]{36})$/;

const sandboxOrigins = (origin: string | null): string[] => {
  if (origin === null || !URL.canParse(origin)) return [];
  const { port } = new URL(origin);
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
};
const json = (body: RpcResponse, status = 200) => Response.json(body, { status });
const fail = (code: KiboErrorCode, message: string, status: number) =>
  json({ ok: false, error: { code, message } }, status);
const internal = (e: unknown) => {
  console.error("[kibo-daemon] request failed", e);
  return fail("INTERNAL", "internal error", 500);
};
const unredacted = (text: string) => text;
const respond = async (work: () => unknown, redact: (text: string) => string): Promise<Response> => {
  try {
    return json({ ok: true, result: (await work()) ?? null });
  } catch (e) {
    if (!(e instanceof KiboError) || HIDDEN.has(e.code)) return internal(e);
    return fail(e.code, redact(e.detail), STATUS[e.code] ?? 400);
  }
};

export function startServer(opts: ServerOptions): { url: string; port: number; stop(): void } {
  const sessions = new Set<string>();
  const redact = opts.redact ?? unredacted;
  let port = opts.port;
  const hosts = () => [`127.0.0.1:${port}`, `localhost:${port}`];
  const origins = () => {
    const sandbox = sandboxOrigins(opts.sandboxOrigin?.() ?? null);
    const extra = (opts.extraOrigins ?? []).filter((o) => !sandbox.includes(o));
    return [`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...extra];
  };
  const hasSession = (req: Request) => {
    const id = readCookie(req.headers.get("cookie"), COOKIE);
    return id !== null && sessions.has(id);
  };

  const handleApi = async (req: Request, url: URL, srv: Server<undefined>): Promise<Response | undefined> => {
    if (!origins().includes(req.headers.get("origin") ?? ""))
      return fail("FORBIDDEN", "origin not allowed", 403);

    if (url.pathname === "/api/pair" && req.method === "POST") {
      const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
      if (typeof body?.token !== "string" || !sameSecret(body.token, opts.token)) {
        return fail("UNAUTHORIZED", "invalid pairing token", 401);
      }
      const id = newSessionId();
      sessions.add(id);
      return new Response(null, {
        status: 204,
        headers: { "set-cookie": `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/` },
      });
    }

    if (!hasSession(req)) return fail("UNAUTHORIZED", "pair this browser first", 401);

    if (url.pathname === "/api/events") {
      return srv.upgrade(req, { data: undefined })
        ? undefined
        : new Response("upgrade failed", { status: 400 });
    }
    if (url.pathname === "/api/rpc" && req.method === "POST") {
      const parsed = RpcRequest.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return fail("INVALID_INPUT", rpcRefusal(parsed.error), 400);
      return respond(() => opts.service.handle(parsed.data), redact);
    }
    if (url.pathname === "/api/code" && req.method === "POST" && opts.code) {
      const code = opts.code;
      const parsed = CodeRequest.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return fail("INVALID_INPUT", parsed.error.message, 400);
      return respond(() => code.handle(parsed.data), redact);
    }
    return new Response("not found", { status: 404 });
  };

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port,
    maxRequestBodySize: MAX_BODY_BYTES,
    async fetch(req, srv) {
      const url = new URL(req.url);
      if (!hosts().includes(req.headers.get("host") ?? ""))
        return new Response("forbidden host", { status: 403 });
      const hookRun = HOOK_PATH.exec(url.pathname)?.[1];
      if (hookRun) {
        const res = opts.hooks
          ? await handleHook(req, hookRun, opts.hooks)
          : new Response("not found", { status: 404 });
        res.headers.set("cache-control", "no-store");
        return res;
      }
      if (url.pathname.startsWith("/components/")) {
        return serveTrusted(req, url, { assets: opts.assets, origins, hasSession });
      }
      if (!url.pathname.startsWith("/api/")) {
        return withUiHeaders(serveUi(opts.uiDir, url.pathname), opts.sandboxOrigin?.() ?? null);
      }
      const res = await handleApi(req, url, srv);
      res?.headers.set("cache-control", "no-store");
      return res;
    },
    websocket: {
      open(ws) {
        ws.subscribe("changes");
      },
      message() {},
    },
  });
  port = server.port ?? opts.port;
  const publish = (message: ChangeMessage) => {
    server.publish("changes", redact(JSON.stringify(message)));
  };
  const off = opts.service.onChange(publish);
  const offCode = opts.code?.onChange(publish);
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stop: () => {
      off();
      offCode?.();
      server.stop(true);
    },
  };
}

const uiHeaders = (sandboxOrigin: string | null) => ({
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    `font-src 'self' data:; connect-src 'self'; ${sandboxOrigin ? `frame-src ${sandboxOrigin}; ` : ""}frame-ancestors 'none'; ` +
    "base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
});

function withUiHeaders(res: Response, sandboxOrigin: string | null): Response {
  for (const [name, value] of Object.entries(uiHeaders(sandboxOrigin))) res.headers.set(name, value);
  return res;
}

function serveUi(uiDir: string | null, pathname: string): Response {
  if (!uiDir) return new Response("ui not built", { status: 404 });
  const root = resolve(uiDir);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return new Response("bad path", { status: 400 });
  }
  const file = resolve(root, `.${decoded}`);
  if (file !== root && !file.startsWith(root + sep)) return new Response("forbidden", { status: 403 });
  let isFile: boolean;
  try {
    isFile = statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return new Response("bad path", { status: 400 });
  }
  if (isFile) return new Response(Bun.file(file));
  return new Response(Bun.file(join(root, "index.html")));
}
