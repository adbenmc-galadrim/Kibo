import { statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const uiHeaders = (sandboxOrigin: string | null) => ({
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    `font-src 'self' data:; connect-src 'self'; ${sandboxOrigin ? `frame-src ${sandboxOrigin}; ` : ""}frame-ancestors 'none'; ` +
    "base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
});

export function withUiHeaders(res: Response, sandboxOrigin: string | null): Response {
  for (const [name, value] of Object.entries(uiHeaders(sandboxOrigin))) res.headers.set(name, value);
  return res;
}

export function serveUi(uiDir: string | null, pathname: string): Response {
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
