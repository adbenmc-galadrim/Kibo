import { type Batch, type SprintView, type TicketView, undecidedActionIds } from "@kibo/schema";

export type SprintMove = { actionId: number; shortKey: string; to: string | null };
export type SprintProposal = { batchId: string; seq: number; moves: SprintMove[] };

export function pendingSprintActions(
  batches: readonly Batch[],
  sprint: Pick<SprintView, "id">,
  tickets: readonly Pick<TicketView, "key" | "shortKey" | "sprintId" | "feature">[],
): SprintProposal | null {
  const pending = batches.find((b) => b.status === "pending");
  if (!pending) return null;
  const inSprint = new Map(
    tickets.filter((t) => t.feature !== null && t.sprintId === sprint.id && t.key).map((t) => [t.key, t]),
  );
  const undecided = new Set(undecidedActionIds(pending));
  const moves = pending.actions.flatMap((a) => {
    if (a.type !== "setSprint" || !undecided.has(a.id)) return [];
    const feature = inSprint.get(a.ticket);
    return feature ? [{ actionId: a.id, shortKey: feature.shortKey ?? a.ticket, to: a.sprint }] : [];
  });
  return moves.length > 0 ? { batchId: pending.id, seq: pending.seq, moves } : null;
}
