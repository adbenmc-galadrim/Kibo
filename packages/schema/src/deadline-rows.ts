import type { FeatureState } from "./feature-state";
import type { FeatureStep } from "./feature-steps";
import { currentSprint, nextSprint, type Sprint, type SprintView, sortSprints } from "./sprint";
import { FINAL_STATUSES } from "./startable";
import type { StatusId } from "./status";

export const DEADLINE_WEEKS = 4;
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

export type DeadlineColumn = { start: string; sprint: Pick<Sprint, "id" | "code"> | null };
export type DeadlineCell = { statusId: StatusId; blocked: boolean; slipped: boolean };
export type DeadlineRow = {
  featureId: string;
  shortKey: string;
  title: string;
  sprintId: string;
  cells: DeadlineCell[];
  column: number;
  slipTo: Pick<Sprint, "id" | "code"> | null;
  blockedBy: string | null;
};
export type DeadlineFeature = {
  id: string;
  shortKey: string;
  title: string;
  sprintId: string;
  rank: number;
  state: FeatureState;
  steps: FeatureStep[];
};
export type DeadlineInput = {
  sprints: readonly SprintView[];
  features: readonly DeadlineFeature[];
  blockingQuestions: ReadonlyMap<string, string>;
  today: string;
};

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const dateOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
const sprintRef = (s: Pick<Sprint, "id" | "code">): Pick<Sprint, "id" | "code"> => ({
  id: s.id,
  code: s.code,
});

export function deadlineColumns(sprints: readonly SprintView[], today: string): DeadlineColumn[] {
  const anchor = currentSprint(sprints, today) ?? nextSprint(sprints, today);
  if (anchor === null) return [];
  const first = dayNumber(anchor.start);
  const sorted = sortSprints(sprints);
  return Array.from({ length: DEADLINE_WEEKS }, (_, week) => {
    const from = first + week * WEEK_DAYS;
    const starting = sorted.find((s) => dayNumber(s.start) >= from && dayNumber(s.start) < from + WEEK_DAYS);
    return { start: dateOf(from), sprint: starting === undefined ? null : sprintRef(starting) };
  });
}

export function todayOffset(columns: readonly DeadlineColumn[], today: string): number | null {
  const first = columns[0];
  if (first === undefined) return null;
  const offset = (dayNumber(today) - dayNumber(first.start)) / (columns.length * WEEK_DAYS);
  return offset >= 0 && offset <= 1 ? offset : null;
}

function cellsOf(f: DeadlineFeature, blocking: ReadonlyMap<string, string>, slips: boolean): DeadlineCell[] {
  const cell = (s: FeatureStep, slipped: boolean): DeadlineCell => ({
    statusId: s.statusId,
    blocked: s.statusId === "blocked" || blocking.has(s.ticketId),
    slipped,
  });
  const remaining = f.steps.filter((s) => !FINAL_STATUSES.includes(s.statusId));
  return [...f.steps.map((s) => cell(s, false)), ...(slips ? remaining.map((s) => cell(s, true)) : [])];
}

function slipTarget(f: DeadlineFeature, sorted: readonly Sprint[]): Pick<Sprint, "id" | "code"> | null {
  if (f.state.status !== "late") return null;
  const index = sorted.findIndex((s) => s.id === f.sprintId);
  const next = index < 0 ? undefined : sorted[index + 1];
  return next === undefined ? null : sprintRef(next);
}

export function deadlineRows(input: DeadlineInput): DeadlineRow[] {
  const columns = deadlineColumns(input.sprints, input.today);
  const columnOf = new Map(columns.flatMap((c, i) => (c.sprint === null ? [] : [[c.sprint.id, i] as const])));
  const sorted = sortSprints(input.sprints);
  return input.features
    .filter((f) => f.state.status !== "delivered" && columnOf.has(f.sprintId))
    .map((f) => ({ f, column: columnOf.get(f.sprintId) ?? 0 }))
    .sort((a, b) => a.column - b.column || a.f.rank - b.f.rank)
    .map(({ f, column }) => {
      const slipTo = slipTarget(f, sorted);
      const nextStep = f.state.nextStepId;
      return {
        featureId: f.id,
        shortKey: f.shortKey,
        title: f.title,
        sprintId: f.sprintId,
        cells: cellsOf(f, input.blockingQuestions, slipTo !== null),
        column,
        slipTo,
        blockedBy:
          f.state.status === "blocked" && nextStep !== null
            ? (input.blockingQuestions.get(nextStep) ?? null)
            : null,
      };
    });
}
