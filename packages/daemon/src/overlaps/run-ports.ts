import { isIgnoredPath, isSecretPath, readProject } from "@kibo/core";
import type { DuplicationSettings, Overlap, RunView, Step, WorkspaceIndex } from "@kibo/schema";
import type { GitRunner } from "../agents/workspace-prep";
import type { Docs } from "../docs";
import type { TraceService } from "../moments/trace-service";
import type { PathScreen } from "./peek-path";
import type { OverlapStore } from "./store";
import type { WorkViewServices } from "./work-view";
import { type WorkspaceRef, workspaceOf } from "./workspace";
import type { WorkspaceIndexer } from "./workspace-index";

export type RunPortsDeps = {
  docs: Pick<Docs, "project" | "projectIds" | "today">;
  trace: Pick<TraceService, "trace">;
  store: Pick<OverlapStore, "list">;
  indexer: WorkspaceIndexer;
  runs(): RunView[];
  settings(projectId: string): DuplicationSettings;
  git: GitRunner;
  now(): number;
  log(line: string): void;
};

export const screenFor =
  (settings: (projectId: string) => Pick<DuplicationSettings, "ignore">) =>
  (projectId: string): PathScreen =>
  (path) => {
    if (isSecretPath(path)) return "secret";
    return isIgnoredPath(path, settings(projectId)) ? "ignored" : null;
  };

export function createRunPorts(
  deps: RunPortsDeps,
): WorkViewServices & { run(runId: string): RunView | null } {
  const run = (runId: string): RunView | null => deps.runs().find((r) => r.id === runId) ?? null;

  const planOf = (projectId: string, ticketId: string): Step[] | null => {
    if (!deps.docs.projectIds().includes(projectId)) return null;
    const ticket = readProject(deps.docs.project(projectId), deps.docs.today()).tickets.find(
      (t) => t.id === ticketId,
    );
    const plan = ticket?.agentProgress?.plan ?? [];
    return plan.length > 0 ? plan : null;
  };

  async function indexOf(ws: WorkspaceRef, runIds: string[]): Promise<WorkspaceIndex | null> {
    const cached = deps.indexer.cached(ws);
    if (cached) return cached;
    const projectId = runIds.map(run).find((r) => r?.projectId)?.projectId ?? null;
    if (projectId === null) return null;
    try {
      return await deps.indexer.index(ws, runIds, deps.settings(projectId));
    } catch (e) {
      deps.log(`overlaps: détection partielle, index of ${ws.key} failed: ${String(e)}`);
      return null;
    }
  }

  const overlapsBetween = (runId: string, otherRunId: string): Overlap[] =>
    deps.store.list({ runId }).filter((o) => o.ownerRunId === otherRunId || o.otherRunId === otherRunId);

  return {
    run,
    runs: deps.runs,
    workspaceOf: (r) => workspaceOf(r, deps.git, (id) => deps.trace.trace(id)?.baseHead ?? null, deps.log),
    indexOf,
    planOf,
    overlapsBetween,
    runName: (r) => r.label,
    now: deps.now,
  };
}
