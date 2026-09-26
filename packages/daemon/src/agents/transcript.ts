import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

export const Usage = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
});
export type Usage = z.infer<typeof Usage>;

const TranscriptLine = z.object({
  type: z.string(),
  message: z.object({ usage: Usage.optional() }).optional(),
});

export function usageTokens(usage: Usage | undefined): number {
  if (!usage) return 0;
  return (
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  );
}

export function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

export function transcriptTokens(text: string): number {
  let total = 0;
  for (const line of text.split("\n")) {
    const parsed = TranscriptLine.safeParse(parseJsonLine(line));
    if (parsed.success && parsed.data.type === "assistant") total += usageTokens(parsed.data.message?.usage);
  }
  return total;
}

export function transcriptTokensAt(path: string | null): number {
  return path && existsSync(path) ? transcriptTokens(readFileSync(path, "utf8")) : 0;
}
