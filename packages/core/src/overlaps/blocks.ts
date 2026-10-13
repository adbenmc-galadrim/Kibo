import { type LineHash, overlapKey } from "@kibo/schema";
import type { Hasher } from "./normalize";
import { type LineWindow, windowSizeFor, windowsOf } from "./windows";

export type Block = {
  aStart: number;
  bStart: number;
  lines: number;
  chars: number;
  aLine: number;
  bLine: number;
};

export const positionsOf = (windows: readonly LineWindow[]): Map<string, number[]> => {
  const out = new Map<string, number[]>();
  for (const w of windows) {
    const positions = out.get(w.hash);
    if (positions) positions.push(w.at);
    else out.set(w.hash, [w.at]);
  }
  return out;
};

const sameLine = (a: readonly LineHash[], i: number, b: readonly LineHash[], j: number): boolean =>
  i < a.length && j < b.length && a[i]?.hash === b[j]?.hash;

const runLength = (a: readonly LineHash[], i: number, b: readonly LineHash[], j: number): number => {
  let length = 0;
  while (sameLine(a, i + length, b, j + length)) length++;
  return length;
};

const charsOf = (lines: readonly LineHash[], start: number, length: number): number =>
  lines.slice(start, start + length).reduce((sum, l) => sum + l.chars, 0);

export function blocksBetween(
  a: readonly LineHash[],
  aWindows: readonly LineWindow[],
  b: readonly LineHash[],
  inB: ReadonlyMap<string, readonly number[]>,
  minLines: number,
): Block[] {
  const coveredUntil = new Map<number, number>();
  const blocks: Block[] = [];
  for (const w of aWindows) {
    for (const bStart of inB.get(w.hash) ?? []) {
      const diagonal = w.at - bStart;
      if (w.at < (coveredUntil.get(diagonal) ?? 0)) continue;
      const lines = runLength(a, w.at, b, bStart);
      coveredUntil.set(diagonal, w.at + lines);
      if (lines < minLines) continue;
      blocks.push({
        aStart: w.at,
        bStart,
        lines,
        chars: charsOf(a, w.at, lines),
        aLine: a[w.at]?.line ?? 0,
        bLine: b[bStart]?.line ?? 0,
      });
    }
  }
  return blocks;
}

export function commonBlocks(
  a: readonly LineHash[],
  b: readonly LineHash[],
  minLines: number,
  hash: Hasher,
): Block[] {
  const size = windowSizeFor(minLines);
  return blocksBetween(a, windowsOf(a, hash, size), b, positionsOf(windowsOf(b, hash, size)), minLines);
}

export function blockKey(a: readonly LineHash[], block: Block, hash: Hasher): string {
  const hashes = a.slice(block.aStart, block.aStart + block.lines).map((l) => l.hash);
  return overlapKey("block", hash(hashes.join("\n")));
}
