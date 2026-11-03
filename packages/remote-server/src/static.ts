import { realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
    "font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

const page = (body: Blob | string, status = 200) => new Response(body, { status, headers: HEADERS });

const isFile = (path: string): boolean => {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return false;
  }
};

const inside = (root: string, path: string) => path === root || path.startsWith(root + sep);

export function serveStatic(staticDir: string | null, pathname: string): Response {
  if (!staticDir) return page("not found", 404);
  const root = realpathSync(resolve(staticDir));
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return page("bad path", 400);
  }
  const requested = resolve(root, `.${decoded}`);
  if (!inside(root, requested)) return page("forbidden", 403);
  const target = isFile(requested) ? requested : join(root, "index.html");
  if (!isFile(target)) return page("not found", 404);
  const real = realpathSync(target);
  return inside(root, real) ? page(Bun.file(real)) : page("forbidden", 403);
}
