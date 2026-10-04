import { z } from "zod";
import type { ExternalRef } from "./external-ref";
import { mcpUrlAllowed, WebUrl } from "./integrations";

export const DESIGN_PROVIDERS = ["figma", "penpot"] as const;
export const DesignProvider = z.enum(DESIGN_PROVIDERS);
export type DesignProvider = z.infer<typeof DesignProvider>;
export const Uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const PenpotInstanceUrl = z.string().url().refine(mcpUrlAllowed, "https required unless loopback");
export const FigmaFrameKey = z.object({
  provider: z.literal("figma"),
  fileKey: z.string().regex(/^[A-Za-z0-9]{6,64}$/),
  nodeId: z.string().regex(/^\d+:\d+$/),
});
export const PenpotFrameKey = z.object({
  provider: z.literal("penpot"),
  instance: PenpotInstanceUrl,
  fileId: Uuid,
  pageId: Uuid,
  boardId: Uuid,
});
export const DesignFrameKey = z.discriminatedUnion("provider", [FigmaFrameKey, PenpotFrameKey]);
export type DesignFrameKey = z.infer<typeof DesignFrameKey>;
export type ParsedDesignUrl = { key: DesignFrameKey; url: string };

export const DESIGN_URL_MAX = 2048;
export const DESIGN_FRESH_MS = 3_600_000;
export const MAX_DESIGN_FRAME_BYTES = 4 * 1024 * 1024;
export const MAX_DESIGN_CACHE_BYTES = 200 * 1024 * 1024;
export const DESIGN_CACHE_IDLE_MS = 90 * 86_400_000;
export const DESIGN_TOKENS_SHELL = 256;
export const FrameMime = z.enum(["image/png", "image/webp", "image/jpeg"]);
export type FrameMime = z.infer<typeof FrameMime>;
type FrameExtension = "png" | "webp" | "jpg";
const EXTENSIONS: Record<FrameMime, FrameExtension> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};
export const frameExtension = (mime: FrameMime): FrameExtension => EXTENSIONS[mime];

export const DesignFrame = z.object({
  id: z.string().min(1),
  provider: DesignProvider,
  name: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  url: z.string().url(),
  mime: FrameMime,
  fetchedAt: z.number(),
  stale: z.boolean(),
  reachable: z.boolean(),
  source: WebUrl,
});
export type DesignFrame = z.infer<typeof DesignFrame>;

export const PenpotBoardRef = z.object({
  kind: z.literal("penpot_board"),
  instance: PenpotInstanceUrl,
  fileId: Uuid,
  pageId: Uuid,
  boardId: Uuid,
  url: WebUrl,
  name: z.string().max(200),
});
export type PenpotBoardRef = z.infer<typeof PenpotBoardRef>;

const FIGMA_HOSTS = new Set(["figma.com", "www.figma.com"]);
const FIGMA_PATH = /^\/(?:design|file|proto)\/([A-Za-z0-9]{6,64})(?:\/|$)/;
const FIGMA_NODE = /^(\d+)[-:](\d+)$/;
const PENPOT_WORKSPACE = /^\/workspace\/[^/]+\/[^/]+\/([^/]+)$/;
const PENPOT_VIEW = /^\/view\/([^/]+)$/;

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
  return path === "/workspace" ? params.get("file-id") : null;
}

function penpotKey(u: URL): DesignFrameKey | null {
  if (!mcpUrlAllowed(u.origin)) return null;
  const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
  const [path = "", query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
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

export function designFrameId(key: DesignFrameKey): string {
  if (key.provider === "figma") return `figma:${key.fileKey}/${key.nodeId}`;
  return `penpot:${new URL(key.instance).host}/${key.fileId}/${key.pageId}/${key.boardId}`;
}

export function frameKeyOfRef(ref: ExternalRef): DesignFrameKey | null {
  if (ref.kind === "figma_node") return { provider: "figma", fileKey: ref.fileKey, nodeId: ref.nodeId };
  if (ref.kind === "penpot_board") {
    return {
      provider: "penpot",
      instance: ref.instance,
      fileId: ref.fileId,
      pageId: ref.pageId,
      boardId: ref.boardId,
    };
  }
  return null;
}
