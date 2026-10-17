import {
  type CiRun,
  DELIVERY_STEP_MAX,
  deadlineColumns,
  deadlineRows,
  deliveryStepLabel,
  type Link,
  type OverviewIndicators,
  openLimitOf,
  overviewIndicators,
  type ProjectEvent,
  type Question,
  type QuestionRecipient,
  type SprintView,
  type Status,
  type TicketView,
  type TrackingSettings,
  todayOffset,
} from "@kibo/schema";
import type { TimelineInput } from "@kibo/sdk/tracking";
import {
  blockingRefs,
  duration,
  type FeatureFacts,
  featureFacts,
  featureKeyOf,
  metaOf,
} from "./overview-facts";
import { type QuestionRow, questionRows, type ReviewRow, reviewRows } from "./review-model";
import { type NextCard, nextCard, type SprintCard, sprintCard } from "./sprint-model";

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
export type OverviewModel = {
  indicators: OverviewIndicators;
  now: NowRow[];
  deadlines: Omit<TimelineInput, "collapsed">;
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

function deadlines(input: OverviewInput, features: readonly FeatureFacts[], blocking: Map<string, string>) {
  const columns = deadlineColumns(input.sprints, input.today);
  const planned = features.flatMap((f) => (f.sprintId === null ? [] : [{ ...f, sprintId: f.sprintId }]));
  return {
    columns,
    rows: deadlineRows({
      sprints: input.sprints,
      features: planned,
      blockingQuestions: blocking,
      today: input.today,
    }),
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
  };
  return {
    indicators: overviewIndicators({
      snapshot: {
        tickets,
        sprints: [...input.sprints],
        questions: [...input.questions],
        meta: metaOf(input.tracking),
      },
      today: input.today,
    }),
    now: nowRows(input.tickets, input.now),
    deadlines: deadlines(input, features, blocking),
    sprint: sprintCard(sprintInput),
    next: nextCard(sprintInput),
    review: reviewRows(input),
    questions: questionRows(input),
  };
}
