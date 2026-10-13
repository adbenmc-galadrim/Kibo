import type { LineHash } from "@kibo/schema";

export type Hasher = (text: string) => string;

export const LINE_HASH_LENGTH = 16;

const COMMENT_STARTS = ["//", "#", "/*", "*", "<!--", "-->"];
const PUNCTUATION_ONLY = /^[{}[\]();, ]+$/;

export function normalizeLine(raw: string): string | null {
  const line = raw.trim().replace(/\s+/g, " ");
  if (line === "") return null;
  if (COMMENT_STARTS.some((start) => line.startsWith(start))) return null;
  if (PUNCTUATION_ONLY.test(line)) return null;
  return line;
}

export function lineHashes(addedLines: readonly { line: number; text: string }[], hash: Hasher): LineHash[] {
  const out: LineHash[] = [];
  for (const { line, text } of addedLines) {
    const normalized = normalizeLine(text);
    if (normalized === null) continue;
    out.push({ line, hash: hash(normalized).slice(0, LINE_HASH_LENGTH), chars: normalized.length });
  }
  return out;
}
