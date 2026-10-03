import { realpathSync, statSync } from "node:fs";
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

function realInside(root: string, file: string): string | null {
  const realRoot = realpathSync(root);
  const real = realpathSync(file);
  return real === realRoot || real.startsWith(realRoot + sep) ? real : null;
}

const isRegularFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

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
  const index = join(root, "index.html");
  let isFile: boolean;
  let hasIndex: boolean;
  try {
    isFile = isRegularFile(file);
    hasIndex = isFile || isRegularFile(index);
  } catch {
    return page(new Response("bad path", { status: 400 }));
  }
  if (!hasIndex) return page(new Response("ui not built", { status: 404 }));
  const target = isFile ? file : index;
  let real: string | null;
  try {
    real = realInside(root, target);
  } catch {
    return page(new Response("bad path", { status: 400 }));
  }
  if (real === null) return page(new Response("forbidden", { status: 403 }));
  if (isFile && isWorkerScript(realpathSync(root), real))
    return withHeaders(new Response(Bun.file(real)), workerHeaders);
  return page(new Response(Bun.file(real)));
}
