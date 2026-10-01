import { type IconOwner, iconOwnerKey } from "@kibo/schema";
import type { IconStore } from "./icon-store";

export type IconRouteDeps = {
  icons: Pick<IconStore, "get">;
  origins(): string[];
  hasSession(req: Request): boolean;
};

const HEADERS = { "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" };
const PROJECT_PATH = /^\/icons\/project\/([A-Za-z0-9-]+)$/;

const plain = (body: string, status: number) =>
  new Response(body, { status, headers: { ...HEADERS, "cache-control": "no-store" } });

export function parseIconPath(pathname: string): IconOwner | null {
  if (pathname === "/icons/workspace") return { kind: "workspace" };
  const projectId = PROJECT_PATH.exec(pathname)?.[1];
  return projectId ? { kind: "project", projectId } : null;
}

export function serveIcon(req: Request, url: URL, deps: IconRouteDeps): Response {
  const origin = req.headers.get("origin");
  if (origin !== null && !deps.origins().includes(origin)) return plain("forbidden origin", 403);
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return plain("forbidden site", 403);
  if (!deps.hasSession(req)) return plain("unauthorized", 401);
  const owner = parseIconPath(url.pathname);
  if (req.method !== "GET" || !owner) return plain("not found", 404);
  const icon = deps.icons.get(iconOwnerKey(owner));
  if (!icon) return plain("not found", 404);
  return new Response(icon.bytes, {
    headers: {
      ...HEADERS,
      "content-type": icon.mime,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
