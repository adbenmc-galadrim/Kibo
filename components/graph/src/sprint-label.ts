import { type SprintPhase, type SprintState, type SprintView, sprintPhase } from "@kibo/schema";
import { fr } from "./fr";

const t = fr.sprints;
const PHASE_OF_STATE: Record<SprintState, SprintPhase> = {
  done: "ended",
  current: "current",
  planned: "upcoming",
};

const dayMonth = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${t.months[d.getUTCMonth()] ?? ""}`;
};

export const lanePhase = (
  sprint: Pick<SprintView, "start" | "end" | "state">,
  today: string | null,
): SprintPhase => (today === null ? PHASE_OF_STATE[sprint.state] : sprintPhase(sprint, today));

export function sprintStateLabel(phase: SprintPhase, end: string, remaining: number): string {
  if (phase !== "ended") return t.phase[phase];
  const ended = t.phase.ended(dayMonth(end));
  return remaining > 0 ? `${ended} · ${t.rest(remaining)}` : ended;
}
