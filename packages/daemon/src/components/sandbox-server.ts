import type { Capability, SandboxFile } from "@kibo/schema";
import type { DraftAssets } from "../ai/draft-preview";
import {
  type AssetLookup,
  lookupAsset,
  parseAssetPath,
  parseDraftAssetPath,
  parseFilePath,
} from "./asset-path";
import { type FileOpener, fileResponse } from "./file-response";

export type { AssetLookup } from "./asset-path";
export { type FileOpener, fileHeaders, type ServedFile } from "./file-response";

export const SANDBOX_INDEX =
  '<!doctype html><html><head><meta charset="utf-8"><style>html,body,#root{height:100%}</style>' +
  '<link rel="stylesheet" href="ui.css" crossorigin="anonymous"></head>' +
  '<body><div id="root"></div><script type="module" src="ui.sandbox.js"></script></body></html>';

const SANDBOX_FILES: readonly SandboxFile[] = ["index.html", "ui.sandbox.js", "ui.css"];
const TYPES: Record<SandboxFile, string> = {
  "index.html": "text/html; charset=utf-8",
  "ui.sandbox.js": "text/javascript; charset=utf-8",
  "ui.css": "text/css; charset=utf-8",
};

export function sandboxHeaders(
  uiPort: number,
  extraAncestors: readonly string[] = [],
  capabilities: readonly Capability[] = [],
): Record<string, string> {
  const ancestors = [`http://127.0.0.1:${uiPort}`, `http://localhost:${uiPort}`, ...extraAncestors].join(" ");
  const media = capabilities.includes("audio") ? "media-src 'self' blob: data:; " : "";
  const connect = capabilities.includes("assets") ? "'self'" : "'none'";
  return {
    "content-security-policy":
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
      `${media}connect-src ${connect}; frame-ancestors ${ancestors}; base-uri 'none'; form-action 'none'`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-site",
    "cache-control": "no-store",
  };
}

export type SandboxServerOptions = {
  port: number;
  uiPort: number;
  assets: AssetLookup;
  extraAncestors?: readonly string[];
  drafts?: DraftAssets;
  files?: FileOpener;
};

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function startSandboxServer(opts: SandboxServerOptions): { url: string; port: number; stop(): void } {
  const headersFor = (capabilities: readonly Capability[]) =>
    sandboxHeaders(opts.uiPort, opts.extraAncestors, capabilities);
  const headers = headersFor([]);
  const plain = (body: string, status: number) => new Response(body, { status, headers });
  const file = (body: Uint8Array | string, name: SandboxFile, capabilities: readonly Capability[]) => {
    const extra: Record<string, string> = name === "index.html" ? {} : { "access-control-allow-origin": "*" };
    return new Response(body, {
      headers: { ...headersFor(capabilities), "content-type": TYPES[name], ...extra },
    });
  };
  const serveDraft = async (draftId: string, hash: string, name: SandboxFile): Promise<Response> => {
    if (!opts.drafts) return plain("not found", 404);
    const body = await opts.drafts.lookup(draftId, hash, name);
    if (body === null) return plain("not found", 404);
    const manifest = await opts.drafts.manifest(draftId);
    return file(body, name, manifest?.capabilities ?? []);
  };
  const serveFile = async (token: string, name: string, method: "GET" | "HEAD"): Promise<Response> => {
    try {
      const found = opts.files ? await opts.files.open(token) : null;
      if (!found || found.name !== name) return plain("not found", 404);
      return (await fileResponse(found, method)) ?? plain("not found", 404);
    } catch (e) {
      console.error(`[kibo-daemon] project file not served: ${reason(e)}`);
      return plain("not found", 404);
    }
  };
  const serve = (req: Request, port: number): Response | Promise<Response> => {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.get("host") ?? "")) {
      return plain("forbidden host", 403);
    }
    const pathname = new URL(req.url).pathname;
    const project = parseFilePath(pathname);
    if (project) {
      if (req.method !== "GET" && req.method !== "HEAD") return plain("method not allowed", 405);
      return serveFile(project.token, project.name, req.method);
    }
    if (req.method !== "GET") return plain("method not allowed", 405);
    const draft = parseDraftAssetPath(pathname);
    if (draft) return serveDraft(draft.draftId, draft.hash, draft.file);
    const asset = parseAssetPath(pathname, "c", SANDBOX_FILES);
    if (!asset) return plain("not found", 404);
    const found = lookupAsset(opts.assets, asset);
    if (!found) return plain("not found", 404);
    const body = asset.file === "index.html" ? SANDBOX_INDEX : found.stored.build[asset.file];
    if (body === undefined) return plain("not found", 404);
    return file(body, asset.file, found.capabilities);
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port,
    maxRequestBodySize: 0,
    fetch: (req, srv): Response | Promise<Response> => serve(req, srv.port ?? opts.port),
    error: (e): Response => {
      console.error(`[kibo-daemon] sandbox request failed: ${reason(e)}`);
      return plain("internal error", 500);
    },
  });
  const port = server.port ?? opts.port;
  return { url: `http://127.0.0.1:${port}`, port, stop: () => server.stop(true) };
}
