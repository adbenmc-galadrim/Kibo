import { z } from "zod";
import { ProjectCommand } from "./command";
import { DataKey } from "./instance";
import { McpImportItem, McpServerId } from "./integrations";
import { BuiltinEntityType } from "./manifest";
import { NotePath } from "./note";

export const FetchInit = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().max(1_048_576).optional(),
});
export type FetchInit = z.infer<typeof FetchInit>;
export type FetchInitInput = z.input<typeof FetchInit>;
export type FetchResponse = { status: number; headers: Record<string, string>; body: string };

export const ComponentCall = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("list"), entity: BuiltinEntityType }),
  z.object({ kind: z.literal("run"), command: ProjectCommand }),
  z.object({ kind: z.literal("data.get"), key: DataKey }),
  z.object({ kind: z.literal("data.delete"), key: DataKey }),
  z.object({ kind: z.literal("data.set"), key: DataKey, value: z.unknown() }),
  z.object({ kind: z.literal("data.keys") }),
  z.object({ kind: z.literal("fetch"), url: z.string().max(4096), init: FetchInit }),
  z.object({ kind: z.literal("action"), name: z.string().min(1).max(128), input: z.unknown() }),
  z.object({ kind: z.literal("notes.read"), path: NotePath }),
  z.object({
    kind: z.literal("notes.write"),
    path: NotePath,
    markdown: z.string().max(1_048_576),
    expectedMtime: z.number().nullable(),
  }),
  z.object({ kind: z.literal("notes.rename"), from: NotePath, to: NotePath }),
  z.object({ kind: z.literal("notes.remove"), path: NotePath }),
  z.object({ kind: z.literal("notes.search"), query: z.string().max(200) }),
  z.object({ kind: z.literal("notes.info") }),
  z.object({
    kind: z.literal("mcp.call"),
    server: McpServerId,
    tool: z.string().min(1).max(128),
    args: z.record(z.string(), z.unknown()),
  }),
  z.object({ kind: z.literal("mcp.read"), server: McpServerId, uri: z.string().min(1).max(2048) }),
  z.object({ kind: z.literal("mcp.import"), server: McpServerId, item: McpImportItem }),
  z.object({ kind: z.literal("presence.list") }),
  z.object({ kind: z.literal("sharing.get") }),
]);
export type ComponentCall = z.infer<typeof ComponentCall>;
