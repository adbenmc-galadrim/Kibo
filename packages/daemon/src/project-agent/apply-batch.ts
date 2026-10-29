import { isSkipped, type RefTable, resolveRefs, staleReason } from "@kibo/core/project-agent/apply-plan";
import type { BatchContext } from "@kibo/core/project-agent/expected";
import { isNewRef, ticketRefsOf } from "@kibo/core/project-agent/refs";
import {
  type ActionResult,
  type Actor,
  type Batch,
  KiboError,
  type ProjectEventSink,
  type ProposedAction,
} from "@kibo/schema";
import { type ActionRunnerDeps, type Created, runAction } from "./apply-actions";
import { type SignalRefsPort, signalRefs } from "./signal-refs";
import type { ProjectAgentAgentsPort, ProjectAgentDataPort } from "./types";

export type ApplyBatchDeps = {
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgentsPort;
  signals: SignalRefsPort;
  events?: ProjectEventSink;
  now?: () => number;
};

const DETAIL_MAX = 1_000;
type Run = { deps: ApplyBatchDeps; batch: Batch; ctx: BatchContext; by: Actor; refs: Map<string, Created> };

const result = (
  action: ProposedAction,
  outcome: ActionResult["outcome"],
  detail: string | null = null,
  created: Created | null = null,
): ActionResult => ({ actionId: action.id, outcome, detail: detail?.slice(0, DETAIL_MAX) ?? null, created });

const failure = (e: KiboError): string => (e.code === "AGENT_EXECUTION_REMOVED" ? e.message : e.detail);

async function contextOf(deps: ApplyBatchDeps, batch: Batch): Promise<BatchContext> {
  const { data } = deps;
  const project = data.project(batch.projectId);
  const notes = await data.notes(batch.projectId);
  return {
    project,
    runs: deps.agents().state().runs,
    notes: notes.map((n) => ({ path: n.path, hash: n.hash })),
    agents: data.agents(batch.projectId),
    demoProject: data.isDemoProject(batch.projectId),
    viewer: data.viewer(batch.projectId),
    agentExecution: "hidden",
    ...signalRefs(deps.signals, batch.projectId),
  };
}

const runnerOf = (run: Run): ActionRunnerDeps => ({
  data: run.deps.data,
  projectId: run.batch.projectId,
  by: run.by,
  ctx: run.ctx,
  refs: run.refs,
  agents: run.deps.agents,
  events: run.deps.events,
});

const failedDependency = (action: ProposedAction, refs: RefTable): string | undefined =>
  ticketRefsOf(action).find((ref) => isNewRef(ref) && !refs.has(ref));

async function applyOne(
  run: Run,
  action: ProposedAction,
  chosen: ReadonlySet<number>,
): Promise<ActionResult> {
  if (isSkipped(action, chosen)) return result(action, "skipped", "décochée");
  const resolved = resolveRefs(action, run.refs, run.ctx.project);
  if (!resolved.ok) {
    const dependency = failedDependency(action, run.refs);
    return result(action, dependency ? "skipped" : "stale", resolved.reason);
  }
  const expected = run.batch.expected.find((e) => e.actionId === action.id) ?? {
    actionId: action.id,
    fields: {},
  };
  const stale = staleReason(action, expected, run.ctx, resolved.ids);
  if (stale) return result(action, "stale", stale);
  try {
    const created = await runAction(runnerOf(run), action, resolved.ids);
    if (created && action.type === "createTicket") run.refs.set(action.ref, created);
    return result(action, "applied", null, created);
  } catch (e) {
    if (e instanceof KiboError) return result(action, "failed", failure(e));
    throw e;
  }
}

function earlierRefs(batch: Batch): Map<string, Created> {
  const refs = new Map<string, Created>();
  for (const r of batch.results) {
    const action = batch.actions.find((a) => a.id === r.actionId);
    if (r.outcome === "applied" && r.created && action?.type === "createTicket")
      refs.set(action.ref, r.created);
  }
  return refs;
}

export async function applyBatch(
  deps: ApplyBatchDeps,
  batch: Batch,
  chosen: ReadonlySet<number>,
  by: Actor,
): Promise<ActionResult[]> {
  const run: Run = { deps, batch, ctx: await contextOf(deps, batch), by, refs: earlierRefs(batch) };
  const results: ActionResult[] = [];
  for (const action of [...batch.actions].sort((a, b) => a.id - b.id)) {
    results.push(await applyOne(run, action, chosen));
  }
  return results;
}
