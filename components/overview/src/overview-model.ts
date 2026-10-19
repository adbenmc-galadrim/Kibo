import {
  type CiRun,
  DELIVERY_STEP_MAX,
  deadlineColumns,
  deadlineRows,
  deliveryStepLabel,
  inProgressFeatures,
  type Link,
  openLimitOf,
  overviewIndicators,
  type ProjectEvent,
  type Question,
  type QuestionRecipient,
  type SprintView,
  type Status,
  sortSprints,
  type TicketView,
  type TrackingSettings,
  todayOffset,
} from "@kibo/schema";
import type { MarkedRow, TimelineInput } from "@kibo/sdk/tracking";
import { deadlineSpan, markRows } from "./deadline-marks";
import { type HeldRow, heldCount, heldRows } from "./held-model";
import type { IndicatorFacts } from "./indicator-texts";
import { type LateRow, lateRows } from "./late-model";
import {
  blockingRefs,
  duration,
  type FeatureFacts,
  featureFacts,
  featureKeyOf,
  metaOf,
} from "./overview-facts";
import { type QuestionRow, questionRows, type ReviewRow, reviewRows } from "./review-model";
import { aheadOfSprint, type NextCard, nextCard, type SprintCard, sprintCard } from "./sprint-model";

export type OverviewInput = {
  tickets: readonly TicketView[];
  links: readonly Link[];
  sprints: readonly SprintView[];
  questions: readonly Question[];
  events: readonly ProjectEvent[];
  ciRuns: readonly CiRun[];
  recipients: readonly QuestionRecipient[];
  workflow: readonly Pick<Status, "id" | "label">[];
  tracking: TrackingSettings | null;
  today: string;
  now: number;
};
export type Segment = "done" | "current" | "todo";
export type NowRow = {
  ticketId: string;
  key: string;
  title: string;
  feature: string | null;
  featureId: string | null;
  step: string | null;
  segments: Segment[];
  duration: string;
};
export type Deadlines = Omit<TimelineInput, "collapsed" | "rows"> & { rows: MarkedRow[]; later: number };
export type OverviewModel = {
  indicators: IndicatorFacts;
  now: NowRow[];
  deadlines: Deadlines;
  late: LateRow[];
  held: HeldRow[];
  sprints: SprintView[];
  sprint: SprintCard | null;
  next: NextCard | null;
  review: ReviewRow[];
  questions: QuestionRow[];
};

const segmentsOf = (step: number | null): Segment[] =>
  Array.from({ length: DELIVERY_STEP_MAX + 1 }, (_, i) =>
    step === null || i > step ? "todo" : i < step ? "done" : "current",
  );

export function nowRows(tickets: readonly TicketView[], now: number): NowRow[] {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  return tickets
    .flatMap((t) => (t.session === null ? [] : [{ t, session: t.session }]))
    .sort((a, b) => a.session.startedAt - b.session.startedAt)
    .map(({ t, session }) => {
      const step = t.delivery?.step ?? null;
      const featureId = t.parentId === null ? null : (byId.get(t.parentId)?.id ?? null);
      return {
        ticketId: t.id,
        key: t.keyLabel,
        title: t.title,
        feature: featureKeyOf(t.id, byId),
        featureId,
        step: step === null ? null : deliveryStepLabel(step),
        segments: segmentsOf(step),
        duration: duration(now - session.startedAt),
      };
    });
}

function deadlines(
  input: OverviewInput,
  features: readonly FeatureFacts[],
  blocking: Map<string, string>,
): Deadlines {
  const span = deadlineSpan(input.sprints, features, input.today);
  const columns = deadlineColumns(input.sprints, input.today, span.weeks);
  const planned = features.flatMap((f) => (f.sprintId === null ? [] : [{ ...f, sprintId: f.sprintId }]));
  return {
    columns,
    later: span.later,
    rows: markRows(
      deadlineRows({
        sprints: input.sprints,
        features: planned,
        blockingQuestions: blocking,
        today: input.today,
        weeks: span.weeks,
      }),
      { features, sprints: input.sprints, events: input.events, today: input.today },
    ),
    today: todayOffset(columns, input.today),
  };
}

export function overviewModel(input: OverviewInput): OverviewModel {
  const features = featureFacts(input.tickets, input.links);
  const blocking = blockingRefs(input.questions);
  const tickets = [...input.tickets];
  const sprintInput = {
    tickets,
    sprints: input.sprints,
    features,
    blocking,
    limit: openLimitOf(input.tracking),
    today: input.today,
    events: input.events,
  };
  const sprint = sprintCard(sprintInput);
  const held = heldRows(input.tickets);
  return {
    indicators: {
      ...overviewIndicators({
        snapshot: {
          tickets,
          sprints: [...input.sprints],
          questions: [...input.questions],
          meta: metaOf(input.tracking),
        },
        today: input.today,
      }),
      blockedFeatures: inProgressFeatures(features, sprintInput.limit).blocked.map((f) => f.shortKey),
      ahead: aheadOfSprint(sprintInput).map((f) => f.shortKey),
      atRisk: sprint?.rows.filter((r) => r.risk).length ?? 0,
      remaining: sprint?.remaining ?? 0,
      held: heldCount(held),
    },
    now: nowRows(input.tickets, input.now),
    deadlines: deadlines(input, features, blocking),
    late: lateRows({ features, sprints: input.sprints, blocking, today: input.today }),
    held,
    sprints: sortSprints(input.sprints),
    sprint,
    next: nextCard(sprintInput),
    review: reviewRows(input),
    questions: questionRows(input),
  };
}
