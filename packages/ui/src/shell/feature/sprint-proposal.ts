import { type Batch, undecidedActionIds } from "@kibo/schema";

export type SprintProposal = { batchId: string; actionId: number; sprint: string };

export function sprintProposal(batches: readonly Batch[], featureKey: string | null): SprintProposal | null {
  if (featureKey === null) return null;
  for (const batch of batches) {
    if (batch.status !== "pending") continue;
    const undecided = new Set(undecidedActionIds(batch));
    for (const action of batch.actions)
      if (
        undecided.has(action.id) &&
        action.type === "setSprint" &&
        action.ticket === featureKey &&
        action.sprint !== null
      )
        return { batchId: batch.id, actionId: action.id, sprint: action.sprint };
  }
  return null;
}
