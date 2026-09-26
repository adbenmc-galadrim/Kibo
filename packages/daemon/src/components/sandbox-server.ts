import type { SandboxFile } from "@kibo/schema";
import { type AssetLookup, lookupAsset, parseAssetPath } from "./asset-path";

export type { AssetLookup } from "./asset-path";

export const SANDBOX_INDEX =
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="ui.css" crossorigin="anonymous"></head>' +
  '<body><div id="root"></div><script type="module" src="ui.sandbox.js"></script></body></html>';

const SANDBOX_FILES: readonly SandboxFile[] = ["index.html", "ui.sandbox.js", "ui.css"];
const TYPES: Record<SandboxFile, string> = {
  "index.html": "text/html; charset=utf-8",
  "ui.sandbox.js": "text/javascript; charset=utf-8",
  "ui.css": "text/css; charset=utf-8",
};

export function sandboxHeaders(uiPort: number): Record<string, string> {
  return {
    "content-security-policy":
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
      `connect-src 'none'; frame-ancestors http://127.0.0.1:${uiPort} http://localhost:${uiPort}; base-uri 'none'; form-action 'none'`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-site",
    "cache-control": "no-store",
  };
}

export function startSandboxServer(opts: { port: number; uiPort: number; assets: AssetLookup }): {
  url: string;
  port: number;
  stop(): void;
} {
  const headers = sandboxHeaders(opts.uiPort);
  const plain = (body: string, status: number) => new Response(body, { status, headers });
  const serve = (req: Request, port: number): Response => {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.get("host") ?? "")) {
      return plain("forbidden host", 403);
    }
    if (req.method !== "GET") return plain("method not allowed", 405);
    const asset = parseAssetPath(new URL(req.url).pathname, "c", SANDBOX_FILES);
    if (!asset) return plain("not found", 404);
    const found = lookupAsset(opts.assets, asset);
    if (!found) return plain("not found", 404);
    const body = asset.file === "index.html" ? SANDBOX_INDEX : found.stored.build[asset.file];
    if (body === undefined) return plain("not found", 404);
    const extra: Record<string, string> =
      asset.file === "index.html" ? {} : { "access-control-allow-origin": "*" };
    return new Response(body, { headers: { ...headers, "content-type": TYPES[asset.file], ...extra } });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port,
    maxRequestBodySize: 0,
    fetch: (req, srv): Response => serve(req, srv.port ?? opts.port),
  });
  const port = server.port ?? opts.port;
  return { url: `http://127.0.0.1:${port}`, port, stop: () => server.stop(true) };
}
