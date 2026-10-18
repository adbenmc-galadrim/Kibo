import {
  atRisk,
  DEADLINE_MAX_WEEKS,
  DEADLINE_WEEKS,
  type DeadlineRow,
  dayNumber,
  deadlineColumns,
  isInProgressFeature,
  lateFeatures,
  type ProjectEvent,
  type SprintView,
  slippedFrom,
} from "@kibo/schema";
import type { MarkedRow, RowMark } from "@kibo/sdk/tracking";
import { fr } from "./fr";
import type { FeatureFacts } from "./overview-facts";

type MarkInput = {
  features: readonly FeatureFacts[];
  sprints: readonly SprintView[];
  events: readonly ProjectEvent[];
  today: string;
};

function markOf(f: FeatureFacts, late: ReadonlySet<string>, input: MarkInput): RowMark {
  const sprint = input.sprints.find((s) => s.id === f.sprintId) ?? null;
  const risk = sprint !== null && atRisk({ sprint, steps: f.steps }, input.today);
  const from = slippedFrom(input.events, f.id, input.sprints);
  return {
    ...(late.has(f.id) ? { tone: "late" } : risk ? { tone: "risk" } : {}),
    ...(from === null ? {} : { note: fr.sprint.slipped(from) }),
  };
}

export function markRows(rows: readonly DeadlineRow[], input: MarkInput): MarkedRow[] {
  const views = input.features.map((f) => ({ ...f, remaining: f.state.remaining }));
  const late = new Set(lateFeatures(views, input.sprints, input.today).map((f) => f.id));
  const byId = new Map(input.features.map((f) => [f.id, f]));
  return rows.map((row) => {
    const feature = byId.get(row.featureId);
    return feature === undefined ? row : { ...row, ...markOf(feature, late, input) };
  });
}

const WEEK_DAYS = 7;

export function deadlineSpan(
  sprints: readonly SprintView[],
  features: readonly FeatureFacts[],
  today: string,
): { weeks: number; later: number } {
  const first = deadlineColumns(sprints, today)[0];
  if (first === undefined) return { weeks: DEADLINE_WEEKS, later: 0 };
  const weeksTo = features.flatMap((f) => {
    const sprint = sprints.find((s) => s.id === f.sprintId);
    if (sprint === undefined || !isInProgressFeature(f.state)) return [];
    return [Math.floor((dayNumber(sprint.start) - dayNumber(first.start)) / WEEK_DAYS) + 1];
  });
  const later = weeksTo.filter((w) => w > DEADLINE_MAX_WEEKS).length;
  const weeks = later > 0 ? DEADLINE_MAX_WEEKS : Math.max(DEADLINE_WEEKS, ...weeksTo);
  return { weeks, later };
}
