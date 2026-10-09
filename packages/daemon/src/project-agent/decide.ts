import {
  ACTION_DETAIL_MAX,
  type ActionResult,
  type Actor,
  type Batch,
  isDecidable,
  KiboError,
  type ProjectAgentRpcRequest,
} from "@kibo/schema";
import type { AgentContext } from "./context";
import { rejectionMessage } from "./sessions";

export type DecideInput = Omit<ProjectAgentRpcRequest & { method: "decideBatch" }, "method">;

const errorText = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).slice(0, ACTION_DETAIL_MAX);

function decidableBatch(ctx: AgentContext, input: DecideInput): Batch {
  ctx.data.assertWritable(input.projectId);
  const batch = ctx.store.batch(input.batchId);
  if (!batch || batch.projectId !== input.projectId)
    throw new KiboError("NOT_FOUND", `batch ${input.batchId} not found`);
  if (!isDecidable(batch)) throw new KiboError("CONFLICT", `batch ${batch.seq} is already ${batch.status}`);
  return batch;
}

function chosenIds(batch: Batch, actionIds: readonly number[] | undefined): number[] {
  const known = new Set(batch.actions.map((a) => a.id));
  const unknown = (actionIds ?? []).filter((id) => !known.has(id));
  if (unknown.length > 0) throw new KiboError("INVALID_INPUT", `unknown actions: ${unknown.join(", ")}`);
  return actionIds ? batch.actions.map((a) => a.id).filter((id) => actionIds.includes(id)) : [...known];
}

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

export async function decideBatch(
  ctx: AgentContext,
  input: DecideInput,
  send: (projectId: string, text: string) => unknown,
): Promise<Batch> {
  const batch = decidableBatch(ctx, input);
  const by: Actor = { kind: "human", ref: ctx.data.viewer(input.projectId) };
  if (input.decision === "reject") {
    const comment = input.comment ? input.comment : null;
    const rejected = ctx.store.appendBatchEvent(
      batch.id,
      { type: "decided", decision: "reject", by, actionIds: null, comment },
      ctx.now(),
    );
    ctx.emit();
    if (comment !== null) send(input.projectId, rejectionMessage(batch.seq, comment));
    return rejected;
  }
  const chosen = chosenIds(batch, input.actionIds);
  ctx.store.appendBatchEvent(
    batch.id,
    { type: "decided", decision: "apply", by, actionIds: chosen, comment: null },
    ctx.now(),
  );
  ctx.emit();
  const results = await applyResults(ctx, batch, chosen, by);
  const applied = ctx.store.appendBatchEvent(batch.id, { type: "results", results }, ctx.now());
  ctx.emit();
  return applied;
}
