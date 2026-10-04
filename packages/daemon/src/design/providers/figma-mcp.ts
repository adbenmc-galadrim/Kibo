import {
  type DesignFrameKey,
  KiboError,
  MAX_DESIGN_FRAME_BYTES,
  type McpCallResult,
  sniffImage,
} from "@kibo/schema";
import type { McpHub } from "../../mcp/hub";
import type { DesignProviderClient, FrameMeta } from "./types";

export const FIGMA_TOOLS = ["get_metadata", "get_screenshot"] as const;
export type FigmaMcp = DesignProviderClient & { checkTools(): Promise<void> };

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&apos;": "'",
};

export function nameFromMetadata(text: string): string | null {
  const m = /\bname="([^"]*)"/.exec(text);
  if (!m?.[1]) return null;
  const name = m[1].replace(/&(?:amp|quot|lt|gt|#39|apos);/g, (e) => ENTITIES[e] ?? e).trim();
  return name ? name.slice(0, 200) : null;
}

const asKibo = (e: unknown) => (e instanceof KiboError ? e : new KiboError("MCP_FAILED", String(e)));
const textOf = (r: McpCallResult) => r.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");
const pngOf = (r: McpCallResult): Uint8Array | null => {
  for (const c of r.content)
    if (c.type === "image" && c.mimeType === "image/png")
      return Uint8Array.from(Buffer.from(c.data, "base64"));
  return null;
};

export function createFigmaMcp(deps: { hub: McpHub; configured(): boolean }): FigmaMcp {
  const call = async (tool: (typeof FIGMA_TOOLS)[number], key: DesignFrameKey): Promise<McpCallResult> => {
    if (key.provider !== "figma") throw new KiboError("INVALID_INPUT", "not a figma frame");
    if (!deps.configured()) throw new KiboError("NOT_CONNECTED", "figma mcp server is not configured");
    const result = await deps.hub.call("figma", tool, { nodeId: key.nodeId }, null).catch((e: unknown) => {
      throw asKibo(e);
    });
    if (result.isError) throw new KiboError("MCP_FAILED", `figma ${tool} failed for ${key.nodeId}`);
    return result;
  };
  const metadata = async (key: DesignFrameKey): Promise<FrameMeta> => {
    const result = await call("get_metadata", key);
    const name = nameFromMetadata(textOf(result)) ?? (key.provider === "figma" ? key.nodeId : "");
    return { name, width: null, height: null };
  };
  return {
    id: "figma",
    connected: async () => deps.configured(),
    version: async () => null,
    metadata,
    async render(key) {
      const meta = await metadata(key);
      const png = pngOf(await call("get_screenshot", key));
      if (!png || png.length > MAX_DESIGN_FRAME_BYTES || sniffImage(png) !== "image/png")
        throw new KiboError("MCP_FAILED", "figma server returned no png");
      return { meta, body: png, mime: "image/png", version: null };
    },
    async checkTools() {
      const names = (await deps.hub.tools("figma").catch((e: unknown) => Promise.reject(asKibo(e)))).map(
        (t) => t.name,
      );
      const missing = FIGMA_TOOLS.filter((n) => !names.includes(n));
      if (missing.length > 0)
        throw new KiboError("MCP_FAILED", `figma server lacks tools: ${missing.join(", ")}`);
    },
  };
}
