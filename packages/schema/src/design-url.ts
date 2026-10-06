import { DESIGN_URL_MAX, type DesignFrameKey, PenpotFrameKey, Uuid } from "./design";
import { mcpUrlAllowed } from "./integrations";

export type ParsedDesignUrl = { key: DesignFrameKey; url: string };
export const DESIGN_URL_PROBLEMS = [
  "not-a-url",
  "credentials",
  "unknown-site",
  "figma-node-missing",
  "penpot-insecure",
  "penpot-file-missing",
  "penpot-page-missing",
  "penpot-board-missing",
] as const;
export type DesignUrlProblem = (typeof DESIGN_URL_PROBLEMS)[number];

const FIGMA_HOSTS = new Set(["figma.com", "www.figma.com"]);
const FIGMA_PATH = /^\/(?:design|file|proto)\/([A-Za-z0-9]{6,64})(?:\/|$)/;
const FIGMA_NODE = /^(\d+)[-:](\d+)$/;
const PENPOT_WORKSPACE = /^\/workspace\/[^/]+\/[^/]+\/([^/]+)$/;
const PENPOT_VIEW = /^\/view\/([^/]+)$/;
const PENPOT_ROUTE = /^\/(?:workspace|view|dashboard)(?:\/|\?|$)/;
const PENPOT_QUERY_ROUTES = new Set(["/workspace", "/view"]);

const hashOf = (u: URL): string => (u.hash.startsWith("#") ? u.hash.slice(1) : u.hash);
const hashParts = (u: URL): { path: string; params: URLSearchParams } => {
  const [path = "", query = ""] = hashOf(u).split("?");
  return { path, params: new URLSearchParams(query) };
};

function figmaKey(u: URL): DesignFrameKey | null {
  if (u.protocol !== "https:" || !FIGMA_HOSTS.has(u.hostname)) return null;
  const file = FIGMA_PATH.exec(u.pathname);
  const node = FIGMA_NODE.exec(u.searchParams.get("node-id") ?? "");
  if (!file?.[1] || !node) return null;
  return { provider: "figma", fileKey: file[1], nodeId: `${node[1]}:${node[2]}` };
}

function penpotFileId(path: string, params: URLSearchParams): string | null {
  const fromPath = PENPOT_WORKSPACE.exec(path)?.[1] ?? PENPOT_VIEW.exec(path)?.[1];
  if (fromPath) return fromPath;
  return PENPOT_QUERY_ROUTES.has(path) ? params.get("file-id") : null;
}

function penpotKey(u: URL): DesignFrameKey | null {
  if (!mcpUrlAllowed(u.origin)) return null;
  const { path, params } = hashParts(u);
  const parsed = PenpotFrameKey.safeParse({
    provider: "penpot",
    instance: u.origin,
    fileId: penpotFileId(path, params),
    pageId: params.get("page-id"),
    boardId: params.get("board-id"),
  });
  return parsed.success ? parsed.data : null;
}

export function parseDesignUrl(raw: string): ParsedDesignUrl | null {
  const text = raw.trim();
  if (text.length === 0 || text.length > DESIGN_URL_MAX || !URL.canParse(text)) return null;
  const u = new URL(text);
  if (u.username !== "" || u.password !== "") return null;
  const key = figmaKey(u) ?? penpotKey(u);
  return key ? { key, url: u.toString() } : null;
}

function penpotProblem(u: URL): DesignUrlProblem {
  if (!mcpUrlAllowed(u.origin)) return "penpot-insecure";
  const { path, params } = hashParts(u);
  if (!Uuid.safeParse(penpotFileId(path, params)).success) return "penpot-file-missing";
  if (!Uuid.safeParse(params.get("page-id")).success) return "penpot-page-missing";
  return "penpot-board-missing";
}

export function designUrlProblem(raw: string): DesignUrlProblem | null {
  if (parseDesignUrl(raw) !== null) return null;
  const text = raw.trim();
  if (text.length === 0 || text.length > DESIGN_URL_MAX || !URL.canParse(text)) return "not-a-url";
  const u = new URL(text);
  if (u.username !== "" || u.password !== "") return "credentials";
  if (FIGMA_HOSTS.has(u.hostname)) return "figma-node-missing";
  return PENPOT_ROUTE.test(hashOf(u)) ? penpotProblem(u) : "unknown-site";
}
