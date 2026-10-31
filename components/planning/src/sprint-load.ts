import { type SprintView, STEPS_PER_WEEK, sprintWeeks } from "@kibo/schema";

export type SprintLoad = { steps: number; capacity: number; over: boolean };

export function sprintLoad(
  sprint: Pick<SprintView, "start" | "end">,
  cards: readonly { total: number }[],
): SprintLoad {
  const steps = cards.reduce((n, c) => n + c.total, 0);
  const capacity = STEPS_PER_WEEK * sprintWeeks(sprint);
  return { steps, capacity, over: steps > capacity };
}
