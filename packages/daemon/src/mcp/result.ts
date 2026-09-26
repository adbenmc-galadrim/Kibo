import { KiboError, type McpCallResult, type McpContent } from "@kibo/schema";
import { z } from "zod";

export const MCP_MAX_RESULT_BYTES = 1_048_576;
const Text = z.object({ type: z.literal("text"), text: z.string() });
const Image = z.object({
  type: z.literal("image"),
  data: z.string(),
  mimeType: z.string().regex(/^image\//),
});
const CallRaw = z.object({ content: z.array(z.unknown()), isError: z.boolean().optional() });
const ReadRaw = z.object({
  contents: z.array(
    z.object({
      uri: z.string(),
      mimeType: z.string().optional(),
      text: z.string().optional(),
      blob: z.string().optional(),
    }),
  ),
});
const encoder = new TextEncoder();

function cutUtf8(text: string, maxBytes: number): string {
  let out = "";
  let used = 0;
  for (const ch of text) {
    const size = encoder.encode(ch).length;
    if (used + size > maxBytes) break;
    out += ch;
    used += size;
  }
  return out;
}

function limit(items: McpContent[], maxBytes: number): { content: McpContent[]; truncated: boolean } {
  const content: McpContent[] = [];
  let left = maxBytes;
  for (const item of items) {
    const size = item.type === "text" ? encoder.encode(item.text).length : item.data.length;
    if (size <= left) {
      content.push(item);
      left -= size;
      continue;
    }
    if (item.type === "text" && left > 0) content.push({ type: "text", text: cutUtf8(item.text, left) });
    return { content, truncated: true };
  }
  return { content, truncated: false };
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new KiboError("MCP_FAILED", `invalid mcp result: ${r.error.issues[0]?.message ?? "unknown"}`);
  return r.data;
}

export type ResultOptions = { redact?: (text: string) => string; maxBytes?: number };

function finish(items: McpContent[], opts: ResultOptions): { content: McpContent[]; truncated: boolean } {
  const redact = opts.redact ?? ((t: string) => t);
  const redacted = items.map(
    (c): McpContent => (c.type === "text" ? { type: "text", text: redact(c.text) } : c),
  );
  return limit(redacted, opts.maxBytes ?? MCP_MAX_RESULT_BYTES);
}

export function toCallResult(raw: unknown, opts: ResultOptions = {}): McpCallResult {
  const r = parse(CallRaw, raw);
  const items = r.content.flatMap((c): McpContent[] => {
    const t = Text.safeParse(c);
    if (t.success) return [t.data];
    const i = Image.safeParse(c);
    return i.success ? [i.data] : [];
  });
  return { ...finish(items, opts), isError: r.isError === true };
}

export function toReadResult(raw: unknown, opts: ResultOptions = {}): McpCallResult {
  const items = parse(ReadRaw, raw).contents.flatMap((c): McpContent[] => {
    if (c.text !== undefined) return [{ type: "text", text: c.text }];
    if (c.blob !== undefined && c.mimeType?.startsWith("image/"))
      return [{ type: "image", data: c.blob, mimeType: c.mimeType }];
    return [];
  });
  return { ...finish(items, opts), isError: false };
}
