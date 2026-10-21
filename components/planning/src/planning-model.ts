import {
  atRisk,
  currentSprint,
  DEFAULT_OPEN_LIMIT,
  DELIVERY_STEP_MAX,
  type FeatureState,
  type FeatureStep,
  featureLabel,
  featureSteps,
  isFeature,
  isOpen,
  type Link,
  openFeatures,
  type ProjectEvent,
  type Question,
  type SprintPhase,
  type SprintView,
  slippedFrom,
  sortSprints,
  sprintPhase,
  type TicketView,
} from "@kibo/schema";
import { type CaseTone, stepCaseTone } from "@kibo/sdk/tracking";
import { type HeldGroup, heldGroups } from "./held-model";
import { sprintDates } from "./sprint-label";
import { type SprintLoad, sprintLoad } from "./sprint-load";

export { sprintDates } from "./sprint-label";

export type StepTone = CaseTone;
export type CardBadge =
  | { kind: "delivered"; demo: boolean; held: number }
  | { kind: "open" }
  | { kind: "risk" }
  | { kind: "late" }
  | { kind: "blocked"; question: string | null };
export type StepCase = { ticketId: string; key: string; tone: StepTone };
export type FeatureCard = {
  id: string;
  shortKey: string;
  title: string;
  sprintId: string | null;
  badge: CardBadge | null;
  late: boolean;
  atRisk: boolean;
  steps: StepCase[];
  done: number;
  total: number;
  remaining: number;
  next: string | null;
  session: string | null;
  compact: boolean;
  muted: boolean;
  slipped: string | null;
};
export type SprintWarning = { shortKey: string; remaining: number; tone: "red" | "amber" };
export type SprintColumn = {
  sprint: SprintView;
  phase: SprintPhase;
  code: string;
  dates: string;
  cards: FeatureCard[];
  warnings: SprintWarning[];
  load: SprintLoad;
};
export type PlanningModel = {
  sprints: SprintColumn[];
  backlog: FeatureCard[];
  delivered: number;
  total: number;
  unplanned: number;
  open: number;
  limit: number;
  overLimit: boolean;
  openCards: FeatureCard[];
  currentSprintId: string | null;
  held: HeldGroup[];
};
export type PlanningInput = {
  tickets: readonly TicketView[];
  links: readonly Link[];
  sprints: readonly SprintView[];
  questions: readonly Question[];
  events?: readonly ProjectEvent[] | undefined;
  today: string;
  openLimit?: number | undefined;
};

type Facts = {
  input: PlanningInput;
  blocking: ReadonlyMap<string, string | null>;
  sprintOf: ReadonlyMap<string, SprintView>;
};
type Feature = TicketView & { feature: FeatureState };

function blockingQuestions(questions: readonly Question[]): Map<string, string | null> {
  const blocking = new Map<string, string | null>();
  for (const q of questions) {
    if (q.blocking && isOpen(q) && !blocking.get(q.ticketId))
      blocking.set(q.ticketId, q.importRef?.id ?? null);
  }
  return blocking;
}

const toneOf = (step: FeatureStep, blocking: ReadonlyMap<string, string | null>): StepTone =>
  stepCaseTone(step, blocking.has(step.ticketId));

function sessionOf(
  steps: readonly FeatureStep[],
  blocking: ReadonlyMap<string, string | null>,
): string | null {
  const live = steps.filter(
    (s) =>
      s.statusId !== "done" &&
      !blocking.has(s.ticketId) &&
      s.delivery !== null &&
      s.delivery.step < DELIVERY_STEP_MAX,
  );
  live.sort((a, b) => (b.delivery?.at ?? 0) - (a.delivery?.at ?? 0));
  return live[0]?.key ?? null;
}

function badgeOf(state: FeatureState, question: string | null, risk: boolean): CardBadge | null {
  if (state.status === "delivered")
    return { kind: "delivered", demo: state.steps.done < state.steps.total, held: state.held };
  if (state.status === "blocked") return { kind: "blocked", question };
  if (state.status === "late") return { kind: "late" };
  if (risk) return { kind: "risk" };
  return state.status === "open" ? { kind: "open" } : null;
}

function cardOf(f: Feature, facts: Facts): FeatureCard {
  const { input, blocking, sprintOf } = facts;
  const state = f.feature;
  const steps = featureSteps({ feature: f.id, tickets: input.tickets, links: input.links });
  const active = steps.filter((s) => s.onHold === null);
  const sprint = f.sprintId === null ? null : (sprintOf.get(f.sprintId) ?? null);
  const delivered = state.status === "delivered";
  const nextStep = steps.find((s) => s.ticketId === state.nextStepId) ?? null;
  const risk = !delivered && sprint !== null && atRisk({ sprint, steps: active }, input.today);
  return {
    id: f.id,
    shortKey: featureLabel(f) || f.keyLabel,
    title: f.title,
    sprintId: sprint?.id ?? null,
    badge: badgeOf(state, nextStep === null ? null : (blocking.get(nextStep.ticketId) ?? null), risk),
    late: state.status === "late",
    atRisk: risk,
    steps: steps.map((s) => ({ ticketId: s.ticketId, key: s.key, tone: toneOf(s, blocking) })),
    done: state.steps.done,
    total: state.steps.total,
    remaining: state.remaining,
    next: delivered ? null : (nextStep?.key ?? null),
    session: delivered && state.held === 0 ? null : sessionOf(steps, blocking),
    compact: delivered && sprint?.state === "done",
    muted: delivered,
    slipped: slippedFrom(input.events ?? [], f.id, input.sprints),
  };
}

const featuresOf = (tickets: readonly TicketView[]): Feature[] =>
  tickets.filter((t): t is Feature => isFeature(t) && t.feature !== null);

const warningOf = (c: FeatureCard): SprintWarning[] =>
  c.late || c.atRisk
    ? [{ shortKey: c.shortKey, remaining: c.remaining, tone: c.late ? "red" : "amber" }]
    : [];

function sprintColumn(
  sprint: SprintView,
  cards: ReadonlyMap<string, FeatureCard>,
  today: string,
): SprintColumn {
  const own = sprint.features.flatMap((id) => cards.get(id) ?? []);
  return {
    sprint,
    phase: sprintPhase(sprint, today),
    code: sprint.code,
    dates: sprintDates(sprint.start, sprint.end),
    cards: own,
    warnings: own.flatMap(warningOf),
    load: sprintLoad(sprint, own),
  };
}

export function planningModel(input: PlanningInput): PlanningModel {
  const sprintOf = new Map(input.sprints.map((s) => [s.id, s]));
  const facts: Facts = { input, blocking: blockingQuestions(input.questions), sprintOf };
  const features = featuresOf(input.tickets);
  const cards = new Map(features.map((f) => [f.id, cardOf(f, facts)]));
  const all = [...cards.values()];
  const planned = features.filter((f) => f.sprintId !== null && sprintOf.has(f.sprintId));
  const open = openFeatures(planned);
  const limit = input.openLimit ?? DEFAULT_OPEN_LIMIT;
  const openIds = new Set(planned.filter((f) => openFeatures([f]) === 1).map((f) => f.id));
  return {
    sprints: sortSprints(input.sprints).map((s) => sprintColumn(s, cards, input.today)),
    backlog: all.filter((c) => c.sprintId === null),
    delivered: all.filter((c) => c.badge?.kind === "delivered").length,
    total: all.length,
    unplanned: all.filter((c) => c.sprintId === null).length,
    open,
    limit,
    overLimit: open > limit,
    openCards: all.filter((c) => openIds.has(c.id)),
    currentSprintId: currentSprint(input.sprints, input.today)?.id ?? null,
    held: heldGroups(input.tickets, input.sprints, input.today),
  };
}
