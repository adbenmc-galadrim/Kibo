import {
  atRisk,
  type DeadlineCell,
  type FeatureState,
  type FeatureStep,
  FINAL_STATUSES,
  featureLabel,
  featureSteps,
  isFeature,
  isOpen,
  type Link,
  type ProjectEvent,
  type Question,
  type Sprint,
  type SprintView,
  slippedFrom,
  sortSprints,
  type TicketView,
} from "@kibo/schema";
import type { MarkedRow, RowMark, TimelineColumnInput } from "@kibo/sdk/tracking";

export type BandsInput = {
  tickets: readonly TicketView[];
  links: readonly Link[];
  sprints: readonly SprintView[];
  questions: readonly Question[];
  today: string;
  backlog: string;
  events?: readonly ProjectEvent[];
  slipped?: (code: string) => string;
};
export type BandsTimeline = {
  columns: TimelineColumnInput[];
  rows: MarkedRow[];
  today: number | null;
  startsIn: number | null;
  delivered: MarkedRow[];
};

type Feature = TicketView & { feature: FeatureState };
type SprintRef = Pick<Sprint, "id" | "code">;

const BACKLOG_COLUMN = "backlog";
const DAY_MS = 86_400_000;
const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

export function bandsToday(sprints: readonly Pick<Sprint, "start" | "end">[], today: string): number | null {
  const index = sprints.findIndex((s) => today <= s.end);
  const sprint = sprints[index];
  if (sprint === undefined) return null;
  if (today < sprint.start) return index / (sprints.length + 1);
  const length = dayNumber(sprint.end) - dayNumber(sprint.start) + 1;
  const fraction = (dayNumber(today) - dayNumber(sprint.start)) / length;
  return (index + fraction) / (sprints.length + 1);
}

export function startsIn(sprints: readonly Pick<Sprint, "start">[], today: string): number | null {
  const first = sprints[0];
  if (first === undefined || today >= first.start) return null;
  return dayNumber(first.start) - dayNumber(today);
}

function bandColumns(sorted: readonly Sprint[], backlog: string): TimelineColumnInput[] {
  return [
    ...sorted.map((s) => ({ start: s.start, sprint: { id: s.id, code: s.code } })),
    { kind: "unplanned", label: backlog },
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

function markOf(f: Feature, steps: readonly FeatureStep[], facts: RowFacts): RowMark {
  const { input, sorted } = facts;
  const sprint = sorted.find((s) => s.id === f.sprintId) ?? null;
  const late = f.feature.status === "late";
  const risk = !late && sprint !== null && atRisk({ sprint, steps }, input.today);
  const from = slippedFrom(input.events ?? [], f.id, sorted);
  return {
    ...(late ? { tone: "late" } : risk ? { tone: "risk" } : {}),
    ...(from !== null && input.slipped ? { note: input.slipped(from) } : {}),
  };
}

function bandRow(f: Feature, column: number, facts: RowFacts): MarkedRow {
  const { input, sorted, blocking } = facts;
  const steps = featureSteps({ feature: f.id, tickets: input.tickets, links: input.links });
  const slipTo = slipTarget(f, column, sorted);
  const next = f.feature.nextStepId;
  return {
    featureId: f.id,
    shortKey: featureLabel(f) || f.keyLabel,
    title: f.title,
    sprintId: sorted[column]?.id ?? BACKLOG_COLUMN,
    cells: cellsOf(steps, blocking, slipTo !== null),
    column,
    slipTo,
    blockedBy: f.feature.status === "blocked" && next !== null ? (blocking.get(next) ?? null) : null,
    ...markOf(f, steps, facts),
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
    columns: bandColumns(sorted, input.backlog),
    rows: rows.filter((r) => !r.delivered).map((r) => r.row),
    today: bandsToday(sorted, input.today),
    startsIn: startsIn(sorted, input.today),
    delivered: rows.filter((r) => r.delivered).map((r) => r.row),
  };
}
