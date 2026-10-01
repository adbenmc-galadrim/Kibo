import { statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const TAURI_IPC_ORIGINS = "ipc: http://ipc.localhost";

const WORKER_SCRIPT = /^workers\/[A-Za-z0-9._-]+\.js$/;

const workerHeaders = {
  "content-security-policy": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

const documentHeaders = (sandboxOrigin: string | null) => ({
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    `font-src 'self' data:; connect-src 'self' ${TAURI_IPC_ORIGINS}; ` +
    `${sandboxOrigin ? `frame-src ${sandboxOrigin}; ` : ""}frame-ancestors 'none'; ` +
    "base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
});

function withHeaders(res: Response, headers: Record<string, string>): Response {
  for (const [name, value] of Object.entries(headers)) res.headers.set(name, value);
  return res;
}

const isWorkerScript = (root: string, file: string): boolean =>
  WORKER_SCRIPT.test(relative(root, file).split(sep).join("/"));

export function serveUi(uiDir: string | null, pathname: string, sandboxOrigin: string | null): Response {
  const page = (res: Response) => withHeaders(res, documentHeaders(sandboxOrigin));
  if (!uiDir) return page(new Response("ui not built", { status: 404 }));
  const root = resolve(uiDir);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return page(new Response("bad path", { status: 400 }));
  }
  const file = resolve(root, `.${decoded}`);
  if (file !== root && !file.startsWith(root + sep)) return page(new Response("forbidden", { status: 403 }));
  let isFile: boolean;
  try {
    isFile = statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return page(new Response("bad path", { status: 400 }));
  }
  if (isFile && isWorkerScript(root, file)) return withHeaders(new Response(Bun.file(file)), workerHeaders);
  if (isFile) return page(new Response(Bun.file(file)));
  return page(new Response(Bun.file(join(root, "index.html"))));
}
