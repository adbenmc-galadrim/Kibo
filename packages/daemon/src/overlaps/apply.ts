import type { Finding, Reconciliation } from "@kibo/core";
import { KiboError, type MomentData, type Overlap, type OverlapRole, overlapSummary } from "@kibo/schema";
import { pacer } from "./cooperate";
import type { OverlapStore } from "./store";

export type ApplyDeps = {
  store: OverlapStore;
  runName(runId: string): string;
  moment(runId: string, data: MomentData): void;
  emit(): void;
  now: () => number;
  log(line: string): void;
};

export type RunsOf = (workspace: string) => readonly string[];

function momentOf(o: Overlap, role: OverlapRole, runName: (runId: string) => string): MomentData {
  const withRunId = role === "owner" ? o.otherRunId : o.ownerRunId;
  const withRunName = runName(withRunId);
  return {
    kind: "overlap",
    overlapId: o.id,
    overlapKind: o.kind,
    role,
    withRunId,
    withRunName,
    summary: overlapSummary(o.detail, withRunName, role),
  };
}

function created(deps: ApplyDeps, f: Finding, projectId: string, at: number): Overlap | null {
  try {
    return deps.store.create(f, projectId, at);
  } catch (e) {
    if (!(e instanceof KiboError) || e.code !== "CONFLICT") throw e;
    deps.log(`overlaps: ${f.key} already open, not created twice`);
    return null;
  }
}

function announce(deps: ApplyDeps, o: Overlap, runsOf: RunsOf): void {
  const feeds: [string, OverlapRole][] = [
    ...runsOf(o.ownerWorkspace).map((id): [string, OverlapRole] => [id, "owner"]),
    ...runsOf(o.otherWorkspace).map((id): [string, OverlapRole] => [id, "other"]),
  ];
  for (const [runId, role] of feeds) deps.moment(runId, momentOf(o, role, deps.runName));
}

export async function applyReconciliation(
  deps: ApplyDeps,
  projectId: string,
  plan: Reconciliation,
  runsOf: RunsOf,
): Promise<void> {
  const at = deps.now();
  const pace = pacer();
  const made: Overlap[] = [];
  for (const f of plan.create) {
    const o = created(deps, f, projectId, at);
    if (o) made.push(o);
    await pace();
  }
  for (const o of made) announce(deps, o, runsOf);
  if (plan.touch.length > 0) deps.store.touch(plan.touch, at);
  for (const id of plan.resolve) {
    deps.store.event(id, { type: "resolved", role: null, by: null, at });
    await pace();
  }
  if (made.length > 0 || plan.resolve.length > 0) deps.emit();
}
