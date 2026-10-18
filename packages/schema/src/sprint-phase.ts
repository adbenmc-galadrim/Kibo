import type { Sprint } from "./sprint";

export type SprintPhase = "upcoming" | "current" | "ends-today" | "ended";

export function sprintPhase(sprint: Pick<Sprint, "start" | "end">, today: string): SprintPhase {
  if (sprint.end < today) return "ended";
  if (sprint.start > today) return "upcoming";
  return sprint.end === today ? "ends-today" : "current";
}

export const isSprintOver = (sprint: Pick<Sprint, "start" | "end">, today: string): boolean =>
  sprintPhase(sprint, today) === "ended";

export const isSprintRunning = (sprint: Pick<Sprint, "start" | "end">, today: string): boolean => {
  const phase = sprintPhase(sprint, today);
  return phase === "current" || phase === "ends-today";
};
