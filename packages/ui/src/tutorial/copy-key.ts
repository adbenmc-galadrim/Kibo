import type { TicketView, TutorialState } from "@kibo/schema";

type CopyCandidate = Pick<TicketView, "id" | "key" | "parentId" | "startable">;

export function copyKeyOf(
  state: Pick<TutorialState, "seed">,
  tickets: readonly CopyCandidate[],
): string | null {
  const seeded = tickets.find((t) => t.id === state.seed?.copyTicketId);
  if (state.seed === null || seeded === undefined) return null;
  if (seeded.startable) return seeded.key;
  const other = tickets.find((t) => t.parentId !== null && t.key !== null && t.startable);
  return other?.key ?? seeded.key;
}
