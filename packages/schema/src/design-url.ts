import {
  DESIGN_URL_MAX,
  type DesignFrameKey,
  PenpotFrameKey,
  StorybookFrameKey,
  StorybookOriginUrl,
  Uuid,
} from "./design";
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
  "storybook-insecure",
  "storybook-story-missing",
] as const;
export type DesignUrlProblem = (typeof DESIGN_URL_PROBLEMS)[number];

const FIGMA_HOSTS = new Set(["figma.com", "www.figma.com"]);
const FIGMA_PATH = /^\/(?:design|file|proto)\/([A-Za-z0-9]{6,64})(?:\/|$)/;
const FIGMA_NODE = /^(\d+)[-:](\d+)$/;
const PENPOT_WORKSPACE = /^\/workspace\/[^/]+\/[^/]+\/([^/]+)$/;
const PENPOT_VIEW = /^\/view\/([^/]+)$/;
const PENPOT_ROUTE = /^\/(?:workspace|view|dashboard)(?:\/|\?|$)/;
const PENPOT_QUERY_ROUTES = new Set(["/workspace", "/view"]);
const STORYBOOK_IFRAME = "/iframe.html";
const STORYBOOK_MANAGERS = new Set(["/", "/index.html"]);
const STORYBOOK_PATH = /^\/(?:story|docs)\/([^/]+)$/;

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

type StoryExtra = { args?: string | null; globals?: string | null };
type StoryParts = { key: StorybookFrameKey; extra: StoryExtra };

export function storyUrl(origin: string, storyId: string, extra: StoryExtra = {}): string {
  const params = new URLSearchParams({ id: storyId, viewMode: "story" });
  if (extra.args != null) params.set("args", extra.args);
  if (extra.globals != null) params.set("globals", extra.globals);
  return `${origin}${STORYBOOK_IFRAME}?${params.toString()}`;
}

const isStorybookShape = (u: URL): boolean =>
  !FIGMA_HOSTS.has(u.hostname) &&
  (u.pathname === STORYBOOK_IFRAME ||
    (STORYBOOK_MANAGERS.has(u.pathname) && (u.searchParams.has("id") || u.searchParams.has("path"))));

function storyIdOf(u: URL): string | null {
  if (u.pathname === STORYBOOK_IFRAME) return u.searchParams.get("id");
  return STORYBOOK_PATH.exec(u.searchParams.get("path") ?? "")?.[1] ?? null;
}

function storyParts(u: URL): StoryParts | null {
  if (!isStorybookShape(u)) return null;
  const parsed = StorybookFrameKey.safeParse({
    provider: "storybook",
    origin: u.origin,
    storyId: storyIdOf(u),
  });
  if (!parsed.success) return null;
  return {
    key: parsed.data,
    extra: { args: u.searchParams.get("args"), globals: u.searchParams.get("globals") },
  };
}

function urlOf(raw: string): URL | null {
  const text = raw.trim();
  if (text.length === 0 || text.length > DESIGN_URL_MAX || !URL.canParse(text)) return null;
  const u = new URL(text);
  return u.username !== "" || u.password !== "" ? null : u;
}

export function storyUrlWithOrigin(url: string, origin: string): string | null {
  const u = urlOf(url);
  const parts = u ? storyParts(u) : null;
  if (!parts || !URL.canParse(origin)) return null;
  const target = new URL(origin).origin;
  if (!StorybookOriginUrl.safeParse(target).success) return null;
  return storyUrl(target, parts.key.storyId, parts.extra);
}

export function parseDesignUrl(raw: string): ParsedDesignUrl | null {
  const u = urlOf(raw);
  if (!u) return null;
  const key = figmaKey(u) ?? penpotKey(u);
  if (key) return { key, url: u.toString() };
  const story = storyParts(u);
  if (!story) return null;
  return { key: story.key, url: storyUrl(story.key.origin, story.key.storyId, story.extra) };
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
  if (PENPOT_ROUTE.test(hashOf(u))) return penpotProblem(u);
  if (!isStorybookShape(u)) return "unknown-site";
  return mcpUrlAllowed(u.origin) ? "storybook-story-missing" : "storybook-insecure";
}
