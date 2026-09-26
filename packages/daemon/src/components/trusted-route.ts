import type { TrustedFile } from "@kibo/schema";
import { type AssetLookup, lookupAsset, parseAssetPath } from "./asset-path";

export type TrustedRouteDeps = {
  assets: AssetLookup | undefined;
  origins(): string[];
  hasSession(req: Request): boolean;
};

const TRUSTED_FILES: readonly TrustedFile[] = ["ui.trusted.js", "ui.css"];
const TYPES: Record<TrustedFile, string> = {
  "ui.trusted.js": "text/javascript; charset=utf-8",
  "ui.css": "text/css; charset=utf-8",
};
const HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "cross-origin-resource-policy": "same-origin",
};

const plain = (body: string, status: number) => new Response(body, { status, headers: HEADERS });

export function serveTrusted(req: Request, url: URL, deps: TrustedRouteDeps): Response {
  const origin = req.headers.get("origin");
  if (origin !== null && !deps.origins().includes(origin)) return plain("forbidden origin", 403);
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return plain("forbidden site", 403);
  if (!deps.hasSession(req)) return plain("unauthorized", 401);
  const asset = parseAssetPath(url.pathname, "components", TRUSTED_FILES);
  if (req.method !== "GET" || !asset || !deps.assets) return plain("not found", 404);
  const found = lookupAsset(deps.assets, asset);
  if (!found) return plain("not found", 404);
  if (found.trust !== "trusted") return plain("not trusted", 403);
  const body = found.stored.build[asset.file];
  if (body === undefined) return plain("not found", 404);
  return new Response(body, { headers: { ...HEADERS, "content-type": TYPES[asset.file] } });
}
