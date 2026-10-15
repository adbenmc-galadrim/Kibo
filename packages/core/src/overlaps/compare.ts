import {
  DUPLICATION_LIMITS,
  type DuplicationSettings,
  type IndexedFile,
  type OverlapKind,
  overlapKey,
  type WorkspaceIndex,
} from "@kibo/schema";
import { effectiveDuplication } from "../project";
import { type Block, blockKey, blockSteps, positionsOf } from "./blocks";
import { isCandidateExport } from "./exports";
import { isCodePath, isIgnoredPath, isSharedPath, isTestPath } from "./ignore";
import type { Hasher } from "./normalize";
import { finish, type Steps } from "./steps";
import { type LineWindow, windowSizeFor, windowsOf } from "./windows";

export type CandidateSide = { path: string; start: number | null };

export type Candidate = {
  kind: OverlapKind;
  key: string;
  a: CandidateSide;
  b: CandidateSide;
  name: string | null;
  lines: number | null;
  chars: number | null;
};

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

function* windowed(
  files: readonly IndexedFile[],
  settings: DuplicationSettings,
  hash: Hasher,
): Steps<Windowed[]> {
  const out: Windowed[] = [];
  for (const file of files) {
    if (file.clipped || file.lines.length < settings.minLines) continue;
    if (!settings.compareTests && isTestPath(file.path)) continue;
    out.push({ file, windows: windowsOf(file.lines, hash, windowSizeFor(settings.minLines)) });
    yield;
  }
  return out;
}

const filesByWindow = (files: readonly Windowed[]): Map<string, Set<number>> => {
  const out = new Map<string, Set<number>>();
  files.forEach(({ windows }, i) => {
    for (const w of windows) out.set(w.hash, (out.get(w.hash) ?? new Set()).add(i));
  });
  return out;
};

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

type Kept = Map<string, Candidate>;

const keep = (kept: Kept, candidates: readonly Candidate[]): void => {
  for (const c of candidates) {
    const known = kept.get(c.key);
    if (!known || order(c, known) < 0) kept.set(c.key, c);
  }
};

function* blockCandidates(
  a: readonly IndexedFile[],
  b: readonly IndexedFile[],
  settings: DuplicationSettings,
  hash: Hasher,
  kept: Kept,
): Steps<void> {
  const ours = yield* windowed(a, settings, hash);
  const theirs = yield* windowed(b, settings, hash);
  const index = filesByWindow(theirs);
  const positions = new Map<number, Map<string, number[]>>();
  for (const { file: fa, windows } of ours) {
    const partners = new Set(windows.flatMap((w) => [...(index.get(w.hash) ?? [])]));
    for (const i of partners) {
      const partner = theirs[i];
      if (!partner || partner.file.path === fa.path) continue;
      const fb = partner.file;
      const inB = positions.get(i) ?? positionsOf(partner.windows);
      positions.set(i, inB);
      const blocks = yield* blockSteps(fa.lines, windows, fb.lines, inB, settings.minLines);
      const large = blocks.filter((block) => block.chars >= DUPLICATION_LIMITS.blockMinChars);
      keep(kept, large.map(blockCandidate(fa, fb, hash)));
      yield;
    }
    yield;
  }
}

export function* findOverlapsSteps(
  a: WorkspaceIndex,
  b: WorkspaceIndex,
  settings: DuplicationSettings,
  hash: Hasher,
): Steps<Candidate[]> {
  const kept = (index: WorkspaceIndex) => index.files.filter((f) => !isIgnoredPath(f.path, settings));
  const [allA, allB] = [kept(a), kept(b)];
  const copies = copiedPaths(allA, allB);
  const ours = allA.filter((f) => !copies.has(f.path));
  const theirs = allB.filter((f) => !copies.has(f.path));
  const shared = effectiveDuplication({ duplication: settings });
  const unshared = (files: readonly IndexedFile[]) => files.filter((f) => !isSharedPath(f.path, shared));
  const found: Kept = new Map();
  keep(found, exportCandidates(ours, theirs, settings));
  yield;
  if (!a.truncated && !b.truncated)
    yield* blockCandidates(unshared(ours), unshared(theirs), settings, hash, found);
  return [...found.values()].sort(order);
}

export function findOverlaps(
  a: WorkspaceIndex,
  b: WorkspaceIndex,
  settings: DuplicationSettings,
  hash: Hasher,
): Candidate[] {
  return finish(findOverlapsSteps(a, b, settings, hash));
}
