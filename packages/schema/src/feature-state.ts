import type { FeatureStep } from "./feature-steps";
import { isInProgressFeature } from "./in-progress-features";
import type { Sprint } from "./sprint";
import { FINAL_STATUSES, NOT_STARTED_STATUSES } from "./startable";

export type FeatureStatus = "todo" | "open" | "blocked" | "late" | "delivered";
export type FeatureState = {
  status: FeatureStatus;
  steps: { done: number; total: number; mandatoryDone: number; mandatoryTotal: number };
  nextStepId: string | null;
  remaining: number;
  started: boolean;
  held: number;
};
type FeatureStateInput = {
  steps: readonly Pick<FeatureStep, "ticketId" | "statusId" | "optional" | "onHold">[];
  featureId?: string;
  blockingQuestions: ReadonlySet<string>;
  sprint: Pick<Sprint, "end"> | null;
  today: string;
};

export const DEFAULT_OPEN_LIMIT = 2;

const isStarted = (s: { statusId: FeatureStep["statusId"] }): boolean =>
  !NOT_STARTED_STATUSES.includes(s.statusId);
const isDone = (s: { statusId: FeatureStep["statusId"] }): boolean => FINAL_STATUSES.includes(s.statusId);

function questionedFeature(input: FeatureStateInput, next: FeatureStateInput["steps"][number]): boolean {
  if (input.featureId === undefined || !input.blockingQuestions.has(input.featureId)) return false;
  return NOT_STARTED_STATUSES.includes(next.statusId);
}

const isLate = (input: FeatureStateInput): boolean => input.sprint !== null && input.sprint.end < input.today;

type Steps = FeatureStateInput["steps"];

function statusOf(input: FeatureStateInput, steps: Steps, remaining: number): FeatureStatus {
  if (steps.length === 0) return "todo";
  if (remaining === 0) return "delivered";
  const next = steps.find((s) => !isDone(s));
  if (
    next !== undefined &&
    (next.statusId === "blocked" ||
      input.blockingQuestions.has(next.ticketId) ||
      questionedFeature(input, next))
  )
    return "blocked";
  if (isLate(input)) return "late";
  return steps.some(isStarted) ? "open" : "todo";
}

export function featureState(input: FeatureStateInput): FeatureState {
  const active = input.steps.filter((s) => s.onHold === null);
  const mandatory = active.filter((s) => !s.optional);
  const mandatoryDone = mandatory.filter(isDone).length;
  const remaining = mandatory.length - mandatoryDone;
  return {
    status: statusOf(input, active, remaining),
    steps: {
      done: active.filter(isDone).length,
      total: active.length,
      mandatoryDone,
      mandatoryTotal: mandatory.length,
    },
    nextStepId: active.find((s) => !isDone(s))?.ticketId ?? null,
    remaining,
    started: active.some(isStarted),
    held: input.steps.length - active.length,
  };
}

export const isOpenFeature = (s: FeatureState): boolean => isInProgressFeature(s);

export const openFeatures = (views: readonly { feature: FeatureState | null }[]): number =>
  views.filter((v) => v.feature !== null && isOpenFeature(v.feature)).length;

const ratioOf = (s: FeatureState): number => (s.steps.total === 0 ? 0 : s.steps.done / s.steps.total);

export function nextFeature(
  features: readonly { id: string; rank: number; state: FeatureState }[],
): string | null {
  const open = features.filter((f) => isOpenFeature(f.state));
  open.sort(
    (a, b) => ratioOf(b.state) - ratioOf(a.state) || a.state.remaining - b.state.remaining || a.rank - b.rank,
  );
  return open[0]?.id ?? null;
}
