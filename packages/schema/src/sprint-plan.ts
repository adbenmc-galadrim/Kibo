import { addDays } from "./iso-date";
import type { ProjectSetup } from "./project-setup";
import type { Sprint } from "./sprint";

export type PlannedSprint = Pick<Sprint, "code" | "name" | "start" | "end">;

const WEEK_DAYS = 7;
const WEEKEND_DAYS = 3;

const cycleOf = (setup: ProjectSetup): number => WEEK_DAYS * setup.sprintWeeks;

export function sprintPlan(setup: ProjectSetup): PlannedSprint[] {
  const cycle = cycleOf(setup);
  return Array.from({ length: setup.sprintCount }, (_, i) => {
    const start = addDays(setup.sprintStart, i * cycle);
    return { code: `S${i + 1}`, name: `Sprint ${i + 1}`, start, end: addDays(start, cycle - WEEKEND_DAYS) };
  });
}

export const sprintPlanEnd = (setup: ProjectSetup): string =>
  addDays(setup.sprintStart, setup.sprintCount * cycleOf(setup) - WEEKEND_DAYS);
