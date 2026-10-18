import { addDays, dayNumber, nextMonday, type Sprint } from "@kibo/schema";

export type ProposedSprint = { code: string; name: string; start: string; end: string };
type SprintDates = Pick<Sprint, "code" | "start" | "end">;

const DEFAULT_LENGTH = 4;

const suffixOf = (code: string): number => Number(/(\d+)$/.exec(code)?.[1] ?? 0);

const latest = (sprints: readonly SprintDates[]): SprintDates | null =>
  sprints.reduce<SprintDates | null>(
    (last, s) =>
      last === null || s.start > last.start || (s.start === last.start && s.end > last.end) ? s : last,
    null,
  );

export function proposeNextSprint(sprints: readonly SprintDates[], today: string): ProposedSprint {
  const last = latest(sprints);
  const code = `S${Math.max(0, ...sprints.map((s) => suffixOf(s.code))) + 1}`;
  const start = nextMonday(last?.end ?? today);
  const length = last === null ? DEFAULT_LENGTH : dayNumber(last.end) - dayNumber(last.start);
  return { code, name: "", start, end: addDays(start, length) };
}
