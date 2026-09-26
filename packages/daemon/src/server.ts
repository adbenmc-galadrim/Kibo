import { statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { KiboError, type KiboErrorCode, RpcRequest, type RpcResponse } from "@kibo/schema";
import type { Server } from "bun";
import { type HookSink, handleHook } from "./agents/hook-route";
import { newSessionId, readCookie, sameSecret } from "./auth";
import type { Service } from "./service";

export type ServerOptions = {
  service: Service;
  token: string;
  port: number;
  uiDir: string | null;
  extraOrigins?: string[];
  hooks?: HookSink;
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
  PATH_OUTSIDE_PROJECT: 403,
  TOO_LARGE: 413,
};
const HOOK_PATH = /^\/hooks\/([0-9a-f-]{36})$/;

const json = (body: RpcResponse, status = 200) => Response.json(body, { status });
const fail = (code: KiboErrorCode, message: string, status: number) =>
  json({ ok: false, error: { code, message } }, status);

export function startServer(opts: ServerOptions): { url: string; port: number; stop(): void } {
  const sessions = new Set<string>();
  let port = opts.port;
  const hosts = () => [`127.0.0.1:${port}`, `localhost:${port}`];
  const origins = () => [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    ...(opts.extraOrigins ?? []),
  ];
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
      if (!parsed.success) return fail("INVALID_INPUT", parsed.error.message, 400);
      try {
        return json({ ok: true, result: opts.service.handle(parsed.data) ?? null });
      } catch (e) {
        if (e instanceof KiboError) return fail(e.code, e.detail, STATUS[e.code] ?? 400);
        console.error("[kibo-daemon] rpc failed", e);
        return fail("INTERNAL", "internal error", 500);
      }
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
      if (!url.pathname.startsWith("/api/")) return withUiHeaders(serveUi(opts.uiDir, url.pathname));
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
  const off = opts.service.onChange((message) => {
    server.publish("changes", JSON.stringify(message));
  });
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stop: () => {
      off();
      server.stop(true);
    },
  };
}

const UI_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    "font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function withUiHeaders(res: Response): Response {
  for (const [name, value] of Object.entries(UI_HEADERS)) res.headers.set(name, value);
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
