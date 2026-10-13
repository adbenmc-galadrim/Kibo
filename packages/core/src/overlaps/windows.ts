import { DUPLICATION_LIMITS, type LineHash } from "@kibo/schema";
import { type Hasher, LINE_HASH_LENGTH } from "./normalize";

export type LineWindow = { hash: string; at: number };

export const windowSizeFor = (minLines: number): number => Math.min(DUPLICATION_LIMITS.windowLines, minLines);

export const windowHash = (
  lines: readonly LineHash[],
  at: number,
  hash: Hasher,
  size: number = DUPLICATION_LIMITS.windowLines,
): string =>
  hash(
    lines
      .slice(at, at + size)
      .map((l) => l.hash)
      .join("\n"),
  ).slice(0, LINE_HASH_LENGTH);

export function windowsOf(
  lines: readonly LineHash[],
  hash: Hasher,
  size: number = DUPLICATION_LIMITS.windowLines,
): LineWindow[] {
  const out: LineWindow[] = [];
  for (let at = 0; at + size <= lines.length; at++) {
    out.push({ hash: windowHash(lines, at, hash, size), at });
  }
  return out;
}
