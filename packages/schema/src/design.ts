import { z } from "zod";
import type { ExternalRef } from "./external-ref";
import { mcpUrlAllowed, WebUrl } from "./integrations";

export const DESIGN_PROVIDERS = ["figma", "penpot", "storybook"] as const;
export const DesignProvider = z.enum(DESIGN_PROVIDERS);
export type DesignProvider = z.infer<typeof DesignProvider>;
export const IMAGE_DESIGN_PROVIDERS = ["figma", "penpot"] as const;
export type ImageDesignProvider = (typeof IMAGE_DESIGN_PROVIDERS)[number];
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
const isBareOrigin = (raw: string): boolean => {
  if (!URL.canParse(raw)) return false;
  const u = new URL(raw);
  return u.pathname === "/" && u.search === "" && u.hash === "" && u.username === "" && u.password === "";
};
export const StorybookOriginUrl = z
  .string()
  .url()
  .refine(mcpUrlAllowed, "https required unless loopback")
  .refine(isBareOrigin, "origin only");
export const StoryId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,199}$/);
export const StorybookFrameKey = z.object({
  provider: z.literal("storybook"),
  origin: StorybookOriginUrl,
  storyId: StoryId,
});
export type StorybookFrameKey = z.infer<typeof StorybookFrameKey>;
export const DesignFrameKey = z.discriminatedUnion("provider", [
  FigmaFrameKey,
  PenpotFrameKey,
  StorybookFrameKey,
]);
export type DesignFrameKey = z.infer<typeof DesignFrameKey>;

export const DESIGN_URL_MAX = 2048;
export const DESIGN_FRESH_MS = 3_600_000;
export const MAX_DESIGN_FRAME_BYTES = 4 * 1024 * 1024;
export const MAX_DESIGN_CACHE_BYTES = 200 * 1024 * 1024;
export const DESIGN_CACHE_IDLE_MS = 90 * 86_400_000;
export const DESIGN_TOKENS_SHELL = 256;
export const FRAME_LIST_MAX = 20;
export const ImageFrameMime = z.enum(["image/png", "image/webp", "image/jpeg"]);
export type ImageFrameMime = z.infer<typeof ImageFrameMime>;
export const FrameMime = z.enum([...ImageFrameMime.options, "text/html"]);
export type FrameMime = z.infer<typeof FrameMime>;
type FrameExtension = "png" | "webp" | "jpg";
const EXTENSIONS: Record<ImageFrameMime, FrameExtension> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};
export const frameExtension = (mime: ImageFrameMime): FrameExtension => EXTENSIONS[mime];

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
export const isHtmlFrame = (f: Pick<DesignFrame, "mime">): boolean => f.mime === "text/html";

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

export function designFrameId(key: DesignFrameKey): string {
  if (key.provider === "figma") return `figma:${key.fileKey}/${key.nodeId}`;
  if (key.provider === "storybook") return `storybook:${new URL(key.origin).host}/${key.storyId}`;
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
