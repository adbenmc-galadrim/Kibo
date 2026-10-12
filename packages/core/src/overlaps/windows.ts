import { DUPLICATION_LIMITS, type LineHash } from "@kibo/schema";
import { type Hasher, LINE_HASH_LENGTH } from "./normalize";

export type LineWindow = { hash: string; at: number };

export const windowHash = (lines: readonly LineHash[], at: number, hash: Hasher): string =>
  hash(
    lines
      .slice(at, at + DUPLICATION_LIMITS.windowLines)
      .map((l) => l.hash)
      .join("\n"),
  ).slice(0, LINE_HASH_LENGTH);

export function windowsOf(lines: readonly LineHash[], hash: Hasher): LineWindow[] {
  const out: LineWindow[] = [];
  for (let at = 0; at + DUPLICATION_LIMITS.windowLines <= lines.length; at++) {
    out.push({ hash: windowHash(lines, at, hash), at });
  }
  return out;
}
