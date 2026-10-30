import {
  ACTION_DETAIL_MAX,
  type ActionResult,
  type Actor,
  type Batch,
  isDecidable,
  isPartlyDecided,
  KiboError,
  type ProjectAgentRpcRequest,
  undecidedActionIds,
} from "@kibo/schema";
import type { AgentContext } from "./context";
import { rejectionMessage } from "./sessions";

export type DecideInput = Omit<ProjectAgentRpcRequest & { method: "decideBatch" }, "method">;

const errorText = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).slice(0, ACTION_DETAIL_MAX);

function decidableBatch(ctx: AgentContext, input: DecideInput): Batch {
  const batch = ctx.store.batch(input.batchId);
  if (!batch || batch.projectId !== input.projectId)
    throw new KiboError("NOT_FOUND", `batch ${input.batchId} not found`);
  if (!isDecidable(batch)) throw new KiboError("CONFLICT", `batch ${batch.seq} is already ${batch.status}`);
  return batch;
}

function chosenIds(batch: Batch, input: DecideInput): number[] {
  const known = new Set(batch.actions.map((a) => a.id));
  const unknown = (input.actionIds ?? []).filter((id) => !known.has(id));
  if (unknown.length > 0) throw new KiboError("INVALID_INPUT", `unknown actions: ${unknown.join(", ")}`);
  if (input.keepRest && !input.actionIds)
    throw new KiboError("INVALID_INPUT", "keepRest needs the decided action ids");
  const undecided = undecidedActionIds(batch);
  const ids = input.actionIds;
  if (!ids) return undecided;
  const decided = ids.filter((id) => !undecided.includes(id));
  if (decided.length > 0) throw new KiboError("CONFLICT", `actions already decided: ${decided.join(", ")}`);
  return undecided.filter((id) => ids.includes(id));
}

const skipped = (ids: readonly number[], detail: string): ActionResult[] =>
  ids.map((actionId) => ({ actionId, outcome: "skipped", detail, created: null }));

async function applyResults(
  ctx: AgentContext,
  batch: Batch,
  chosen: number[],
  by: Actor,
): Promise<ActionResult[]> {
  try {
    return await ctx.ops.apply(batch, new Set(chosen), by);
  } catch (e) {
    console.error(`[kibo-daemon] applying batch ${batch.id} failed`, e);
    const detail = errorText(e);
    return batch.actions.map((a) => ({
      actionId: a.id,
      outcome: chosen.includes(a.id) ? "failed" : "skipped",
      detail: chosen.includes(a.id) ? detail : null,
      created: null,
    }));
  }
}

function reject(ctx: AgentContext, batch: Batch, input: DecideInput, by: Actor): Batch {
  const keepRest = input.keepRest === true;
  const comment = !keepRest && input.comment ? input.comment : null;
  const ids = keepRest ? chosenIds(batch, input) : undecidedActionIds(batch);
  const event = { type: "decided", decision: "reject", by, comment } as const;
  const rejected = ctx.store.appendBatchEvent(
    batch.id,
    keepRest
      ? { ...event, actionIds: ids, keepRest }
      : { ...event, actionIds: isPartlyDecided(batch) ? ids : null },
    ctx.now(),
  );
  const closed =
    keepRest || isPartlyDecided(batch)
      ? ctx.store.appendBatchEvent(batch.id, { type: "results", results: skipped(ids, "refusée") }, ctx.now())
      : rejected;
  ctx.emit();
  return closed;
}

export async function decideBatch(
  ctx: AgentContext,
  input: DecideInput,
  send: (projectId: string, text: string) => unknown,
): Promise<Batch> {
  const batch = decidableBatch(ctx, input);
  const by: Actor = { kind: "human", ref: ctx.data.viewer(input.projectId) };
  if (input.decision === "reject") {
    const rejected = reject(ctx, batch, input, by);
    if (!input.keepRest && input.comment) send(input.projectId, rejectionMessage(batch.seq, input.comment));
    return rejected;
  }
  const chosen = chosenIds(batch, input);
  const scope = new Set(input.keepRest ? chosen : undecidedActionIds(batch));
  ctx.store.appendBatchEvent(
    batch.id,
    {
      type: "decided",
      decision: "apply",
      by,
      actionIds: chosen,
      comment: null,
      ...(input.keepRest && { keepRest: true }),
    },
    ctx.now(),
  );
  ctx.emit();
  const all = await applyResults(ctx, batch, chosen, by);
  const results = all.filter((r) => scope.has(r.actionId));
  const applied = ctx.store.appendBatchEvent(batch.id, { type: "results", results }, ctx.now());
  ctx.emit();
  return applied;
}
