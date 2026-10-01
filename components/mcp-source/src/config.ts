import { McpServerId } from "@kibo/schema";
import { z } from "zod";
import { fr } from "./fr";

const JsonPointer = z
  .string()
  .max(256)
  .regex(/^(\/[^/]*)*$/);
const JsonObject = z.record(z.string(), z.unknown());

const Stored = z
  .object({
    title: z.string().max(80).optional(),
    server: McpServerId,
    mode: z.enum(["tool", "resource"]),
    tool: z.string().min(1).max(128).optional(),
    uri: z.string().min(1).max(2048).optional(),
    args: z.string().max(8192).default("{}"),
    refreshMinutes: z.number().int().min(5).max(1440).default(15),
    itemsPointer: JsonPointer,
    idPointer: JsonPointer,
    titlePointer: JsonPointer,
    subtitlePointer: JsonPointer.optional(),
    urlPointer: JsonPointer.optional(),
  })
  .refine(
    (c) => (c.mode === "tool" ? c.tool !== undefined : c.uri !== undefined),
    "tool or uri required by mode",
  );
export type McpSourceStoredConfig = z.input<typeof Stored>;

export function parseArgs(text: string): Record<string, unknown> | null {
  try {
    const parsed = JsonObject.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const McpSourceConfig = Stored.transform((c, ctx) => {
  const args = parseArgs(c.args);
  if (args === null) {
    ctx.addIssue({ code: "custom", path: ["args"], message: "args must be a JSON object" });
    return z.NEVER;
  }
  return {
    title: c.title ?? fr.defaultTitle,
    server: c.server,
    mode: c.mode,
    tool: c.tool,
    uri: c.uri,
    args,
    refreshMinutes: c.refreshMinutes,
    mapping: {
      items: c.itemsPointer,
      id: c.idPointer,
      title: c.titlePointer,
      subtitle: c.subtitlePointer,
      url: c.urlPointer,
    },
  };
});
export type McpSourceConfig = z.output<typeof McpSourceConfig>;

export function defaultMcpSourceConfig(server: string): McpSourceStoredConfig {
  return {
    title: fr.defaultTitle,
    server,
    mode: "tool",
    tool: "list_items",
    args: "{}",
    refreshMinutes: 15,
    itemsPointer: "/items",
    idPointer: "/id",
    titlePointer: "/name",
    subtitlePointer: "/detail",
    urlPointer: "/link",
  };
}
