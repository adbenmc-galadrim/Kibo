import { type Sprint, sprintPhase } from "@kibo/schema";
import { fr } from "./fr";

const t = fr.sprints;

const dayMonth = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${t.months[d.getUTCMonth()] ?? ""}`;
};

export function sprintStateLabel(
  sprint: Pick<Sprint, "start" | "end">,
  today: string,
  remaining: number,
): string {
  const phase = sprintPhase(sprint, today);
  if (phase !== "ended") return t.phase[phase];
  const ended = t.phase.ended(dayMonth(sprint.end));
  return remaining > 0 ? `${ended} · ${t.rest(remaining)}` : ended;
}
