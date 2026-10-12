import {
  DUPLICATION_LIMITS,
  doingStep,
  isTerminal,
  type Overlap,
  type ParallelRun,
  type ParallelWork,
  type RunView,
  type Step,
  type WorkspaceIndex,
} from "@kibo/schema";
import type { GitRunner } from "../agents/workspace-prep";
import type { PathScreen, PeekFs } from "./peek-path";
import type { WorkspaceRef } from "./workspace";

export type PeekServices = {
  runs(): RunView[];
  workspaceOf(run: RunView): Promise<WorkspaceRef | null>;
  indexOf(ws: WorkspaceRef, runIds: string[]): Promise<WorkspaceIndex | null>;
  planOf(projectId: string, ticketId: string): Step[] | null;
  overlapsBetween(runId: string, otherRunId: string): Overlap[];
  runName(run: RunView): string;
  screen: PathScreen;
  git: GitRunner;
  fs: PeekFs;
  now: () => number;
};

export type WorkViewServices = Omit<PeekServices, "git" | "fs" | "screen">;

type Placed = { run: RunView; ws: WorkspaceRef | null };
type Described = { run: ParallelRun; partial: boolean };

const EMPTY: ParallelWork = { runs: [], more: 0, overlaps: [], partial: false };

export const startOf = (run: RunView): number => run.startedAt ?? run.createdAt;

const labelKind = (run: RunView): ParallelRun["workspace"] =>
  run.workspace === "repo" ? "repo" : run.workspace?.startsWith("worktree:") ? "worktree" : "isolated";

export const isPeerOf = (run: RunView, other: RunView): boolean =>
  other.id !== run.id &&
  other.kind === "ticket" &&
  other.projectId === run.projectId &&
  other.projectId !== null;

const byStart = (a: RunView, b: RunView): number => startOf(a) - startOf(b) || a.id.localeCompare(b.id);

export function createWorkView(services: WorkViewServices) {
  function base(
    run: RunView,
  ): Omit<ParallelRun, "workspace" | "worktreeName" | "files" | "exports" | "truncated"> {
    const plan = run.projectId && run.ticketId ? services.planOf(run.projectId, run.ticketId) : null;
    return {
      runId: run.id,
      name: services.runName(run),
      ticketKey: run.ticketKey ?? "",
      ticketTitle: run.ticketTitle ?? "",
      startedAt: startOf(run),
      step: plan ? (doingStep(plan)?.title ?? null) : null,
      plan,
    };
  }

  const bare = (run: RunView, workspace: ParallelRun["workspace"], ws: WorkspaceRef | null): ParallelRun => ({
    ...base(run),
    workspace,
    worktreeName: ws?.worktreeName ?? null,
    files: [],
    exports: [],
    truncated: false,
  });

  async function describe(
    placed: Placed,
    mine: WorkspaceRef | null,
    all: readonly Placed[],
  ): Promise<Described> {
    const { run, ws } = placed;
    if (ws === null) {
      const kind = labelKind(run);
      return { run: bare(run, kind, null), partial: kind !== "isolated" };
    }
    if (mine !== null && ws.key === mine.key) return { run: bare(run, "shared", ws), partial: false };
    const runIds = all.filter((p) => p.ws?.key === ws.key).map((p) => p.run.id);
    const index = await services.indexOf(ws, runIds);
    if (index === null) return { run: bare(run, ws.kind, ws), partial: true };
    return {
      run: {
        ...bare(run, ws.kind, ws),
        files: index.files.map((f) => ({
          path: f.path,
          status: f.status,
          added: f.added,
          removed: f.removed,
        })),
        exports: index.files.flatMap((f) => f.exports.map((name) => ({ name, path: f.path }))),
        truncated: index.truncated,
      },
      partial: index.partial,
    };
  }

  function openOverlaps(run: RunView, peers: readonly RunView[]): Overlap[] {
    const seen = new Map<string, Overlap>();
    for (const peer of peers) {
      for (const o of services.overlapsBetween(run.id, peer.id)) if (o.status === "open") seen.set(o.id, o);
    }
    return [...seen.values()];
  }

  async function parallelWork(run: RunView): Promise<ParallelWork> {
    if (run.projectId === null) return EMPTY;
    const peers = services
      .runs()
      .filter((r) => isPeerOf(run, r) && !isTerminal(r.state))
      .sort(byStart);
    const shown = peers.slice(0, DUPLICATION_LIMITS.sectionRuns);
    const mine = await services.workspaceOf(run);
    const placed = await Promise.all(shown.map(async (r) => ({ run: r, ws: await services.workspaceOf(r) })));
    const described = await Promise.all(placed.map((p) => describe(p, mine, placed)));
    return {
      runs: described.map((d) => d.run),
      more: peers.length - shown.length,
      overlaps: openOverlaps(run, peers),
      partial: described.some((d) => d.partial),
    };
  }

  return { parallelWork };
}
