import { relative } from "node:path";
import {
  assignRoles,
  type Candidate,
  type Finding,
  findOverlaps,
  type Hasher,
  type ReconcileScope,
  reconcile,
  startedFirst,
} from "@kibo/core";
import {
  DUPLICATION_LIMITS,
  type DuplicationSettings,
  type Overlap,
  type WorkspaceIndex,
  type WorkspaceRun,
} from "@kibo/schema";
import { isInside } from "../code/safe-path";
import { type ApplyDeps, applyReconciliation } from "./apply";
import { createRunQueue, type RunQueue } from "./queue";
import type { WorkspaceRef } from "./workspace";
import type { WorkspaceIndexer } from "./workspace-index";

export type DetectorSpace = { ws: WorkspaceRef; runs: WorkspaceRun[]; allRunIds: string[] };

export type AutoLinkEvaluator = {
  evaluate(projectId: string, indexes: WorkspaceIndex[], runs: WorkspaceRun[]): Promise<void>;
};

export type DetectorDeps = ApplyDeps & {
  indexer: WorkspaceIndexer;
  workspaces(projectId: string): Promise<DetectorSpace[]>;
  projectOf(runId: string): string | null;
  settings(projectId: string): DuplicationSettings;
  autoLinker: AutoLinkEvaluator | null;
  hash: Hasher;
  queue?: RunQueue;
};

export type SweepResult = { compared: number; partial: boolean };

export type OverlapDetector = {
  onWrite(runId: string, absPath: string): Promise<void>;
  sweep(projectId: string): Promise<SweepResult>;
  forget(runId: string): void;
};

type Indexed = { space: DetectorSpace; index: WorkspaceIndex };

const NOTHING: SweepResult = { compared: 0, partial: false };

const pairOf = (a: string, b: string): string => [a, b].sort().join("\u0000");

const byAge = (x: WorkspaceRun, y: WorkspaceRun): number => (startedFirst(x, y) ? -1 : 1);
const oldest = (s: DetectorSpace): WorkspaceRun | undefined => [...s.runs].sort(byAge)[0];
const youngest = (s: DetectorSpace): WorkspaceRun | undefined => [...s.runs].sort(byAge).at(-1);

function findingsOf(a: Indexed, b: Indexed, candidates: Candidate[], writerRunId: string | null): Finding[] {
  const [ra, rb] = [oldest(a.space), oldest(b.space)];
  if (!ra || !rb) return [];
  const writer = writerRunId === null ? null : a.space.ws.key;
  return candidates.map((c) => {
    const f = assignRoles(c, ra, rb, writer);
    const otherSpace = f.otherWorkspace === a.space.ws.key ? a.space : b.space;
    return { ...f, otherRunId: writerRunId ?? youngest(otherSpace)?.runId ?? f.otherRunId };
  });
}

export function createOverlapDetector(deps: DetectorDeps): OverlapDetector {
  const queue = deps.queue ?? createRunQueue(deps.log);
  const spaceOfRun = new Map<string, string>();

  const listed = async (projectId: string): Promise<DetectorSpace[]> => {
    const spaces = await deps.workspaces(projectId);
    for (const s of spaces) for (const r of s.runs) spaceOfRun.set(r.runId, s.ws.key);
    return spaces;
  };

  const runsOf = (spaces: readonly DetectorSpace[]) => (key: string) =>
    spaces.find((s) => s.ws.key === key)?.runs.map((r) => r.runId) ?? [];

  function settle(
    projectId: string,
    findings: Finding[],
    scope: ReconcileScope,
    resolvable: (o: Overlap) => boolean,
    spaces: readonly DetectorSpace[],
  ): void {
    const open = deps.store.open(projectId);
    const plan = reconcile(open, findings, deps.store.ignoredKeys(projectId), scope);
    const byId = new Map(open.map((o) => [o.id, o]));
    const resolve = plan.resolve.filter((id) => {
      const o = byId.get(id);
      return o !== undefined && resolvable(o);
    });
    applyReconciliation(deps, projectId, { ...plan, resolve }, runsOf(spaces));
  }

  async function writerIndex(space: DetectorSpace, path: string, settings: DuplicationSettings) {
    if (!deps.indexer.cached(space.ws.key)) await deps.indexer.index(space.ws, space.allRunIds, settings);
    return deps.indexer.indexFile(space.ws, path, settings);
  }

  async function checkWrite(runId: string, absPath: string): Promise<void> {
    const projectId = deps.projectOf(runId);
    if (!projectId) return;
    const settings = deps.settings(projectId);
    if (!settings.enabled) return;
    const spaces = await listed(projectId);
    const space = spaces.find((s) => s.runs.some((r) => r.runId === runId));
    if (!space || !isInside(space.ws.key, absPath)) return;
    const path = relative(space.ws.key, absPath);
    const index = await writerIndex(space, path, settings);
    if (!index) return;
    const mine: Indexed = { space, index };
    const findings: Finding[] = [];
    const clean = new Set<string>();
    for (const other of spaces) {
      const theirs = other === space ? null : deps.indexer.cached(other.ws.key);
      if (!theirs) continue;
      const candidates = findOverlaps(index, theirs, settings, deps.hash).filter((c) => c.a.path === path);
      findings.push(...findingsOf(mine, { space: other, index: theirs }, candidates, runId));
      if (!index.partial && !theirs.partial) clean.add(pairOf(space.ws.key, other.ws.key));
    }
    const resolvable = (o: Overlap) => clean.has(pairOf(o.ownerWorkspace, o.otherWorkspace));
    settle(projectId, findings, { kind: "file", workspace: space.ws.key, path }, resolvable, spaces);
  }

  async function indexAll(spaces: DetectorSpace[], settings: DuplicationSettings, deadline: number) {
    const indexed: Indexed[] = [];
    let partial = false;
    for (const space of spaces) {
      if (deps.now() > deadline) {
        deps.log(`overlaps: détection partielle, indexing past its budget at ${space.ws.key}`);
        return { indexed, partial: true, stopped: true };
      }
      try {
        const index = await deps.indexer.index(space.ws, space.allRunIds, settings);
        partial ||= index.partial;
        indexed.push({ space, index });
      } catch (e) {
        partial = true;
        deps.log(`overlaps: détection partielle, index of ${space.ws.key} failed: ${String(e)}`);
      }
    }
    return { indexed, partial, stopped: false };
  }

  function compareAll(
    projectId: string,
    indexed: Indexed[],
    settings: DuplicationSettings,
    deadline: number,
  ) {
    const findings: Finding[] = [];
    const clean = new Set<string>();
    let compared = 0;
    for (const [i, a] of indexed.entries()) {
      for (const b of indexed.slice(i + 1)) {
        findings.push(...findingsOf(a, b, findOverlaps(a.index, b.index, settings, deps.hash), null));
        compared += 1;
        if (!a.index.partial && !b.index.partial) clean.add(pairOf(a.space.ws.key, b.space.ws.key));
        if (deps.now() > deadline) {
          deps.log(`overlaps: détection partielle, sweep of ${projectId} past its budget`);
          return { findings, clean, compared, interrupted: true };
        }
      }
    }
    return { findings, clean, compared, interrupted: false };
  }

  async function sweep(projectId: string): Promise<SweepResult> {
    const settings = deps.settings(projectId);
    if (!settings.enabled) return NOTHING;
    const all = await listed(projectId);
    const ordered = all
      .flatMap((space) => {
        const first = oldest(space);
        return first ? [{ space, first }] : [];
      })
      .sort((x, y) => byAge(x.first, y.first))
      .map((x) => x.space);
    if (ordered.length < 2) return NOTHING;
    const deadline = deps.now() + DUPLICATION_LIMITS.sweepBudgetMs;
    const kept = ordered.slice(0, DUPLICATION_LIMITS.workspacesPerProject);
    let partial = kept.length < ordered.length;
    if (partial) deps.log(`overlaps: détection partielle, ${ordered.length} workspaces in ${projectId}`);
    const { indexed, partial: indexPartial, stopped } = await indexAll(kept, settings, deadline);
    partial ||= indexPartial;
    const { findings, clean, compared, interrupted } = stopped
      ? { findings: [], clean: new Set<string>(), compared: 0, interrupted: true }
      : compareAll(projectId, indexed, settings, deadline);
    partial ||= interrupted;
    const resolvable = (o: Overlap) => !partial || clean.has(pairOf(o.ownerWorkspace, o.otherWorkspace));
    settle(projectId, findings, { kind: "sweep" }, resolvable, all);
    if (!interrupted && deps.autoLinker) {
      const runs = indexed.flatMap((x) => oldest(x.space) ?? []);
      await deps.autoLinker.evaluate(
        projectId,
        indexed.map((x) => x.index),
        runs,
      );
    }
    return { compared, partial };
  }

  return {
    onWrite: (runId, absPath) => queue.push(runId, () => checkWrite(runId, absPath)),
    sweep,
    forget(runId) {
      const key = spaceOfRun.get(runId);
      spaceOfRun.delete(runId);
      if (key && ![...spaceOfRun.values()].includes(key)) deps.indexer.drop(key);
    },
  };
}
