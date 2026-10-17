import {
  type DeadlineCell,
  type DeadlineColumn,
  type DeadlineRow,
  type FeatureState,
  type FeatureStep,
  FINAL_STATUSES,
  featureSteps,
  isFeature,
  isOpen,
  type Link,
  type Question,
  type Sprint,
  type SprintView,
  sortSprints,
  type TicketView,
} from "@kibo/schema";

export type BandsInput = {
  tickets: readonly TicketView[];
  links: readonly Link[];
  sprints: readonly SprintView[];
  questions: readonly Question[];
  today: string;
  backlog: string;
};
export type BandsTimeline = {
  columns: DeadlineColumn[];
  rows: DeadlineRow[];
  today: number | null;
  delivered: DeadlineRow[];
};

type Feature = TicketView & { feature: FeatureState };
type SprintRef = Pick<Sprint, "id" | "code">;

const BACKLOG_COLUMN = "backlog";
const DAY_MS = 86_400_000;
const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const dateOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

export function bandsToday(sprints: readonly Pick<Sprint, "start" | "end">[], today: string): number | null {
  const index = sprints.findIndex((s) => s.start <= today && today <= s.end);
  const sprint = sprints[index];
  if (sprint === undefined) return null;
  const length = dayNumber(sprint.end) - dayNumber(sprint.start) + 1;
  const fraction = (dayNumber(today) - dayNumber(sprint.start)) / length;
  return (index + fraction) / (sprints.length + 1);
}

function bandColumns(sorted: readonly Sprint[], today: string, backlog: string): DeadlineColumn[] {
  const last = sorted.at(-1);
  const after = last === undefined ? today : dateOf(dayNumber(last.end) + 1);
  return [
    ...sorted.map((s) => ({ start: s.start, sprint: { id: s.id, code: s.code } })),
    { start: after, sprint: { id: BACKLOG_COLUMN, code: backlog } },
  ];
}

function blockingRefs(questions: readonly Question[]): Map<string, string> {
  const refs = new Map<string, string>();
  for (const q of questions)
    if (q.blocking && isOpen(q) && !refs.has(q.ticketId)) refs.set(q.ticketId, q.importRef?.id ?? q.title);
  return refs;
}

function cellsOf(steps: readonly FeatureStep[], blocking: ReadonlyMap<string, string>, slips: boolean) {
  const cell = (s: FeatureStep, slipped: boolean): DeadlineCell => ({
    statusId: s.statusId,
    blocked: s.statusId === "blocked" || blocking.has(s.ticketId),
    slipped,
  });
  const remaining = steps.filter((s) => !FINAL_STATUSES.includes(s.statusId));
  return [...steps.map((s) => cell(s, false)), ...(slips ? remaining.map((s) => cell(s, true)) : [])];
}

type RowFacts = {
  input: BandsInput;
  sorted: readonly Sprint[];
  blocking: ReadonlyMap<string, string>;
};

function slipTarget(f: Feature, column: number, sorted: readonly Sprint[]): SprintRef | null {
  const next = f.feature.status === "late" ? sorted[column + 1] : undefined;
  return next === undefined ? null : { id: next.id, code: next.code };
}

function bandRow(f: Feature, column: number, facts: RowFacts): DeadlineRow {
  const { input, sorted, blocking } = facts;
  const steps = featureSteps({ feature: f.id, tickets: input.tickets, links: input.links });
  const slipTo = slipTarget(f, column, sorted);
  const next = f.feature.nextStepId;
  return {
    featureId: f.id,
    shortKey: f.shortKey ?? f.keyLabel,
    title: f.title,
    sprintId: sorted[column]?.id ?? BACKLOG_COLUMN,
    cells: cellsOf(steps, blocking, slipTo !== null),
    column,
    slipTo,
    blockedBy: f.feature.status === "blocked" && next !== null ? (blocking.get(next) ?? null) : null,
  };
}

export function bandsTimeline(input: BandsInput): BandsTimeline {
  const sorted = sortSprints(input.sprints);
  const columnOf = new Map(sorted.map((s, i) => [s.id, i]));
  const facts: RowFacts = { input, sorted, blocking: blockingRefs(input.questions) };
  const rows = input.tickets
    .filter((t): t is Feature => isFeature(t) && t.feature !== null)
    .map((f, rank) => ({
      f,
      rank,
      column: (f.sprintId === null ? undefined : columnOf.get(f.sprintId)) ?? sorted.length,
    }))
    .sort((a, b) => a.column - b.column || a.rank - b.rank)
    .map(({ f, column }) => ({
      delivered: f.feature.status === "delivered",
      row: bandRow(f, column, facts),
    }));
  return {
    columns: bandColumns(sorted, input.today, input.backlog),
    rows: rows.filter((r) => !r.delivered).map((r) => r.row),
    today: bandsToday(sorted, input.today),
    delivered: rows.filter((r) => r.delivered).map((r) => r.row),
  };
}
