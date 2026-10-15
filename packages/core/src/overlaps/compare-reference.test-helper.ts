import {
  DUPLICATION_LIMITS,
  type DuplicationSettings,
  type IndexedFile,
  type LineHash,
  type OverlapKind,
  overlapKey,
  type WorkspaceIndex,
} from "@kibo/schema";
import { effectiveDuplication } from "../project";
import { type Block, blockKey, positionsOf } from "./blocks";
import type { Candidate, CandidateSide } from "./compare";
import { isCandidateExport } from "./exports";
import { isCodePath, isIgnoredPath, isSharedPath, isTestPath } from "./ignore";
import type { Hasher } from "./normalize";
import { type LineWindow, windowSizeFor, windowsOf } from "./windows";

const side = (path: string, start: number | null = null): CandidateSide => ({ path, start });

const candidate = (
  kind: OverlapKind,
  key: string,
  a: CandidateSide,
  b: CandidateSide,
  name: string | null,
) => ({
  kind,
  key,
  a,
  b,
  name,
  lines: null,
  chars: null,
});

const copiedPaths = (a: readonly IndexedFile[], b: readonly IndexedFile[]): Set<string> => {
  const theirs = new Map(b.map((f) => [f.path, f.hash]));
  return new Set(a.filter((f) => theirs.get(f.path) === f.hash).map((f) => f.path));
};

const candidateNames = (file: IndexedFile, settings: DuplicationSettings): string[] =>
  isCodePath(file.path) ? file.exports.filter((n) => isCandidateExport(n, settings.genericExports)) : [];

const pathsByName = (files: readonly IndexedFile[], settings: DuplicationSettings): Map<string, string[]> => {
  const out = new Map<string, string[]>();
  for (const file of files) {
    for (const name of candidateNames(file, settings)) out.set(name, [...(out.get(name) ?? []), file.path]);
  }
  for (const paths of out.values()) paths.sort();
  return out;
};

const exportCandidates = (
  a: readonly IndexedFile[],
  b: readonly IndexedFile[],
  settings: DuplicationSettings,
): Candidate[] => {
  const theirs = pathsByName(b, settings);
  return [...pathsByName(a, settings)].flatMap(([name, ours]) => {
    const other = theirs.get(name);
    if (!other || ours.some((p) => other.includes(p))) return [];
    const [aPath, bPath] = [ours[0], other[0]];
    if (aPath === undefined || bPath === undefined) return [];
    return [candidate("export", overlapKey("export", name), side(aPath), side(bPath), name)];
  });
};

type Windowed = { file: IndexedFile; windows: LineWindow[] };

const windowed = (files: readonly IndexedFile[], settings: DuplicationSettings, hash: Hasher): Windowed[] =>
  files
    .filter((f) => !f.clipped && f.lines.length >= settings.minLines)
    .filter((f) => settings.compareTests || !isTestPath(f.path))
    .map((file) => ({ file, windows: windowsOf(file.lines, hash, windowSizeFor(settings.minLines)) }));

const filesByWindow = (files: readonly Windowed[]): Map<string, Set<number>> => {
  const out = new Map<string, Set<number>>();
  files.forEach(({ windows }, i) => {
    for (const w of windows) out.set(w.hash, (out.get(w.hash) ?? new Set()).add(i));
  });
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

function blocksBetween(
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

const blockCandidate =
  (fa: IndexedFile, fb: IndexedFile, hash: Hasher) =>
  (block: Block): Candidate => ({
    kind: "block",
    key: blockKey(fa.lines, block, hash),
    a: side(fa.path, block.aLine),
    b: side(fb.path, block.bLine),
    name: null,
    lines: block.lines,
    chars: block.chars,
  });

const blockCandidates = (
  a: readonly IndexedFile[],
  b: readonly IndexedFile[],
  settings: DuplicationSettings,
  hash: Hasher,
): Candidate[] => {
  const ours = windowed(a, settings, hash);
  const theirs = windowed(b, settings, hash);
  const index = filesByWindow(theirs);
  const positions = new Map<number, Map<string, number[]>>();
  return ours.flatMap(({ file: fa, windows }) => {
    const partners = new Set(windows.flatMap((w) => [...(index.get(w.hash) ?? [])]));
    return [...partners].flatMap((i) => {
      const partner = theirs[i];
      if (!partner || partner.file.path === fa.path) return [];
      const fb = partner.file;
      const inB = positions.get(i) ?? positionsOf(partner.windows);
      positions.set(i, inB);
      return blocksBetween(fa.lines, windows, fb.lines, inB, settings.minLines)
        .filter((block) => block.chars >= DUPLICATION_LIMITS.blockMinChars)
        .map(blockCandidate(fa, fb, hash));
    });
  });
};

const sortFields = (c: Candidate): (string | number)[] => [
  c.key,
  c.a.path,
  c.a.start ?? 0,
  c.b.path,
  c.b.start ?? 0,
];

const order = (x: Candidate, y: Candidate): number => {
  const [fx, fy] = [sortFields(x), sortFields(y)];
  for (let i = 0; i < fx.length; i++) {
    const [vx, vy] = [fx[i] ?? 0, fy[i] ?? 0];
    if (vx !== vy) return vx < vy ? -1 : 1;
  }
  return 0;
};

const firstPerKey = (candidates: readonly Candidate[]): Candidate[] => {
  const kept = new Map<string, Candidate>();
  for (const c of [...candidates].sort(order)) if (!kept.has(c.key)) kept.set(c.key, c);
  return [...kept.values()];
};

export function referenceFindOverlaps(
  a: WorkspaceIndex,
  b: WorkspaceIndex,
  settings: DuplicationSettings,
  hash: Hasher,
): Candidate[] {
  const kept = (index: WorkspaceIndex) => index.files.filter((f) => !isIgnoredPath(f.path, settings));
  const [allA, allB] = [kept(a), kept(b)];
  const copies = copiedPaths(allA, allB);
  const ours = allA.filter((f) => !copies.has(f.path));
  const theirs = allB.filter((f) => !copies.has(f.path));
  const shared = effectiveDuplication({ duplication: settings });
  const unshared = (files: readonly IndexedFile[]) => files.filter((f) => !isSharedPath(f.path, shared));
  const blocks =
    a.truncated || b.truncated ? [] : blockCandidates(unshared(ours), unshared(theirs), settings, hash);
  return firstPerKey([...exportCandidates(ours, theirs, settings), ...blocks]);
}
