import { type SprintView, sortSprints, type TicketView } from "@kibo/schema";

export function currentSprintOf(sprints: readonly SprintView[]): SprintView | null {
  const sorted = sortSprints(sprints);
  return sorted.filter((s) => s.state === "current").at(-1) ?? sorted.find((s) => s.lingering) ?? null;
}

export const inCurrentSprint = (
  ticket: Pick<TicketView, "effectiveSprintId">,
  currentSprintId: string | null,
): boolean => currentSprintId !== null && ticket.effectiveSprintId === currentSprintId;
