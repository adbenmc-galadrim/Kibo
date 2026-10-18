import { currentSprint, type Sprint, type TicketView } from "@kibo/schema";

export function inCurrentSprint(
  ticket: Pick<TicketView, "effectiveSprintId">,
  sprints: readonly Sprint[],
  today: string,
): boolean {
  const current = currentSprint(sprints, today);
  return current !== null && ticket.effectiveSprintId === current.id;
}

export const localToday = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
