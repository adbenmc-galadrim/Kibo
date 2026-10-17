import type { ActionResult, Batch, BatchEvent, BatchRow, TimedBatchEvent } from "./project-agent";

type Decisions = Pick<Batch, "actions" | "chosen" | "results">;

export function batchStatusOfResults(results: readonly ActionResult[]): "applied" | "partial" {
  return results.every((r) => r.outcome === "applied") ? "applied" : "partial";
}

export function undecidedActionIds(batch: Decisions): number[] {
  const decided = new Set([...(batch.chosen ?? []), ...batch.results.map((r) => r.actionId)]);
  return batch.actions.map((a) => a.id).filter((id) => !decided.has(id));
}

export const isPartlyDecided = (batch: Decisions): boolean =>
  undecidedActionIds(batch).length < batch.actions.length;

const union = (a: readonly number[], b: readonly number[]): number[] => [...new Set([...a, ...b])];

function mergeResults(batch: Batch, next: readonly ActionResult[]): ActionResult[] {
  const byId = new Map(batch.results.map((r) => [r.actionId, r]));
  for (const r of next) byId.set(r.actionId, r);
  return batch.actions.flatMap((a) => byId.get(a.id) ?? []);
}

function decide(batch: Batch, at: number, event: Extract<BatchEvent, { type: "decided" }>): Batch {
  const chosen =
    event.decision === "apply" && event.actionIds !== null
      ? union(batch.chosen ?? [], event.actionIds)
      : batch.chosen;
  const common = { ...batch, decidedBy: event.by, decidedAt: at, chosen };
  if (event.keepRest) return common;
  return {
    ...common,
    status: event.decision === "reject" ? "rejected" : "partial",
    comment: event.comment,
  };
}

function settle(batch: Batch, next: readonly ActionResult[]): Batch {
  const results = mergeResults(batch, next);
  const complete = results.length === batch.actions.length;
  const status = complete
    ? batchStatusOfResults(results)
    : batch.status === "pending"
      ? "pending"
      : "partial";
  return { ...batch, status, results };
}

function foldEvent(batch: Batch, { at, event }: TimedBatchEvent): Batch {
  switch (event.type) {
    case "decided":
      return decide(batch, at, event);
    case "results":
      return settle(batch, event.results);
    case "superseded":
      return { ...batch, status: isPartlyDecided(batch) ? "partial" : "superseded" };
    case "abandoned":
      return { ...batch, status: isPartlyDecided(batch) ? "partial" : "abandoned" };
  }
}

export function foldBatch(row: BatchRow, events: readonly TimedBatchEvent[]): Batch {
  const initial: Batch = {
    ...row,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    chosen: null,
    comment: null,
    results: [],
  };
  return events.reduce(foldEvent, initial);
}

export const isDecidable = (b: Pick<Batch, "status">): boolean => b.status === "pending";
