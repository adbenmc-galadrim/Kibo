import { z } from "zod";

const Content = z.union([z.string(), z.array(z.unknown())]);

export const TranscriptEntry = z
  .object({
    type: z.string(),
    isSidechain: z.boolean().catch(false).default(false),
    timestamp: z.unknown(),
    message: z
      .object({ content: Content, model: z.string().optional().catch(undefined) })
      .passthrough()
      .optional(),
    toolUseResult: z.unknown(),
  })
  .passthrough();
export type TranscriptEntry = z.infer<typeof TranscriptEntry>;

export const TextBlock = z.object({ type: z.literal("text"), text: z.string() }).passthrough();
export const ThinkingBlock = z.object({ type: z.literal("thinking"), thinking: z.string() }).passthrough();
export const ToolUseBlock = z
  .object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.record(z.unknown()).catch({}),
  })
  .passthrough();
export const ToolResultBlock = z
  .object({
    type: z.literal("tool_result"),
    tool_use_id: z.string(),
    content: Content.nullish().catch(null),
    is_error: z.boolean().nullish().catch(null),
  })
  .passthrough();

export const StructuredPatch = z.object({
  structuredPatch: z.array(z.object({ lines: z.array(z.string()) }).passthrough()),
});
