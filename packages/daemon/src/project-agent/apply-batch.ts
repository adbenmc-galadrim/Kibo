import {
  commandsFor,
  isSkipped,
  type RefTable,
  resolveRefs,
  staleReason,
  type TicketIds,
} from "@kibo/core/project-agent/apply-plan";
import type { BatchContext } from "@kibo/core/project-agent/expected";
import { isNewRef, ticketRefsOf } from "@kibo/core/project-agent/refs";
import {
  type ActionResult,
  type Actor,
  type Batch,
  KiboError,
  type ProposedAction,
  Ticket,
} from "@kibo/schema";
import type { ProjectAgentAgentsPort, ProjectAgentDataPort } from "./types";

export type ApplyBatchDeps = {
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgentsPort;
  now?: () => number;
};

const DETAIL_MAX = 1_000;
type Created = { ticketId: string; key: string };
type Run = { deps: ApplyBatchDeps; batch: Batch; ctx: BatchContext; by: Actor; refs: Map<string, Created> };

const result = (
  action: ProposedAction,
  outcome: ActionResult["outcome"],
  detail: string | null = null,
  created: Created | null = null,
): ActionResult => ({ actionId: action.id, outcome, detail: detail?.slice(0, DETAIL_MAX) ?? null, created });

async function contextOf(deps: ApplyBatchDeps, batch: Batch): Promise<BatchContext> {
  const { data } = deps;
  const project = data.project(batch.projectId);
  const notes = await data.notes(batch.projectId);
  return {
    project,
    runs: deps.agents().state().runs,
    notes: notes.map((n) => ({ path: n.path, hash: n.hash })),
    profiles: data.profiles(),
    demoProject: data.isDemoProject(batch.projectId),
    viewer: data.viewer(batch.projectId),
  };
}

const failedDependency = (action: ProposedAction, refs: RefTable): string | undefined =>
  ticketRefsOf(action).find((ref) => isNewRef(ref) && !refs.has(ref));

function createdTicket(run: Run, out: unknown): Created {
  const { id } = Ticket.parse(out);
  const ticket = run.deps.data.project(run.batch.projectId).tickets.find((t) => t.id === id);
  if (!ticket) throw new KiboError("INTERNAL", `created ticket ${id} vanished`);
  return { ticketId: id, key: ticket.key ?? ticket.keyLabel };
}

function idOf(ids: TicketIds, ref: string): string {
  const id = ids[ref];
  if (id === undefined) throw new KiboError("INTERNAL", `unresolved ticket reference ${ref}`);
  return id;
}

async function execute(run: Run, action: ProposedAction, ids: TicketIds): Promise<Created | null> {
  const { data } = run.deps;
  const { projectId } = run.batch;
  switch (action.type) {
    case "assignAgent":
      run.deps.agents().assign({
        projectId,
        ticketId: idOf(ids, action.ticket),
        profileId: action.profileId,
        brief: action.brief ?? "",
        ...(action.fresh !== undefined && { fresh: action.fresh }),
      });
      return null;
    case "deliverAnswers":
      run.deps.agents().deliverAnswers(projectId, idOf(ids, action.ticket));
      return null;
    case "cancelRun":
      run.deps.agents().cancel(action.runId);
      return null;
    case "createNote":
    case "updateNote":
      await data.writeNote(
        projectId,
        action.path,
        action.content,
        action.type === "createNote" ? "create" : "update",
      );
      return null;
    default: {
      let created: Created | null = null;
      for (const command of commandsFor(action, ids, run.by, run.ctx.project)) {
        const out = data.runCommand(projectId, command);
        if (command.method === "createTicket") created = createdTicket(run, out);
      }
      return created;
    }
  }
}

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
    const created = await execute(run, action, resolved.ids);
    if (created && action.type === "createTicket") run.refs.set(action.ref, created);
    return result(action, "applied", null, created);
  } catch (e) {
    if (e instanceof KiboError) return result(action, "failed", e.detail);
    throw e;
  }
}

export async function applyBatch(
  deps: ApplyBatchDeps,
  batch: Batch,
  chosen: ReadonlySet<number>,
  by: Actor,
): Promise<ActionResult[]> {
  const run: Run = { deps, batch, ctx: await contextOf(deps, batch), by, refs: new Map() };
  const results: ActionResult[] = [];
  for (const action of [...batch.actions].sort((a, b) => a.id - b.id)) {
    results.push(await applyOne(run, action, chosen));
  }
  return results;
}
