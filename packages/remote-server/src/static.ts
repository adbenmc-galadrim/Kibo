import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { KiboError } from "@kibo/schema";

const NONCE_BYTES = 16;

const policy = (styleSrc: string) =>
  `default-src 'self'; script-src 'self'; ${styleSrc}; img-src 'self' data: blob:; object-src 'none'; ` +
  "font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; " +
  "frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const headers = (styleSrc = "style-src 'self'"): Record<string, string> => ({
  "content-security-policy": policy(styleSrc),
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
});

const page = (body: Blob | string, status = 200) => new Response(body, { status, headers: headers() });

const freshNonce = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(NONCE_BYTES))).toString("base64");

function withNonce(html: string, nonce: string): string {
  const meta = `<meta property="csp-nonce" content="${nonce}">`;
  const head = html.indexOf("</head>");
  return head === -1 ? meta + html : html.slice(0, head) + meta + html.slice(head);
}

function shell(path: string): Response {
  const nonce = freshNonce();
  return new Response(withNonce(readFileSync(path, "utf8"), nonce), {
    headers: { ...headers(`style-src 'self' 'nonce-${nonce}'`), "content-type": "text/html;charset=utf-8" },
  });
}

const isFile = (path: string): boolean => {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return false;
  }
};

const inside = (root: string, path: string) => path === root || path.startsWith(root + sep);

function resolveRoot(staticDir: string): string {
  const stat = statSync(staticDir, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) throw new KiboError("INVALID_INPUT", `static folder ${staticDir} does not exist`);
  return realpathSync(resolve(staticDir));
}

export function createStatic(staticDir: string | null): (pathname: string) => Response {
  if (!staticDir) return () => page("not found", 404);
  const root = resolveRoot(staticDir);
  const index = join(root, "index.html");
  return (pathname) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return page("bad path", 400);
    }
    const requested = resolve(root, `.${decoded}`);
    if (!inside(root, requested)) return page("forbidden", 403);
    const target = isFile(requested) ? requested : index;
    if (!isFile(target)) return page("not found", 404);
    const real = realpathSync(target);
    if (!inside(root, real)) return page("forbidden", 403);
    return target === index ? shell(real) : page(Bun.file(real));
  };
}
