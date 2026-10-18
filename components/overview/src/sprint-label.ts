import { type Sprint, type SprintPhase, sprintPhase } from "@kibo/schema";
import { fr } from "./fr";
import { dayMonth, sprintDates } from "./overview-facts";

type Dates = Pick<Sprint, "start" | "end">;

export function phaseLabel(phase: SprintPhase, sprint: Dates): string {
  const t = fr.sprint.phase;
  if (phase === "ended") return t.ended(dayMonth(sprint.end));
  if (phase === "upcoming") return t.upcoming(dayMonth(sprint.start));
  return t[phase];
}

export function sprintCardDates(sprint: Dates, today: string, remaining: number): string {
  const phase = sprintPhase(sprint, today);
  const label = phaseLabel(phase, sprint);
  if (phase === "ended") return `${label} · ${fr.sprint.rest(remaining)}`;
  if (phase === "upcoming") return label;
  return sprintDates(sprint.start, sprint.end);
}
