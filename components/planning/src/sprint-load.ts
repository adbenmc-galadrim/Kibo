import { dayNumber, type SprintView } from "@kibo/schema";

export type SprintLoad = { steps: number; capacity: number; over: boolean };

export const STEPS_PER_WEEK = 3;
const WEEK_DAYS = 7;

export const sprintWeeks = (sprint: Pick<SprintView, "start" | "end">): number =>
  Math.max(1, Math.round((dayNumber(sprint.end) - dayNumber(sprint.start) + 1) / WEEK_DAYS));

export function sprintLoad(
  sprint: Pick<SprintView, "start" | "end">,
  cards: readonly { total: number }[],
): SprintLoad {
  const steps = cards.reduce((n, c) => n + c.total, 0);
  const capacity = STEPS_PER_WEEK * sprintWeeks(sprint);
  return { steps, capacity, over: steps > capacity };
}
