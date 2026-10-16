import type { FeatureStep } from "./feature";
import type { Sprint } from "./sprint";
import { FINAL_STATUSES, NOT_STARTED_STATUSES } from "./startable";

export type FeatureStatus = "todo" | "open" | "blocked" | "late" | "delivered";
export type FeatureState = {
  status: FeatureStatus;
  steps: { done: number; total: number; mandatoryDone: number; mandatoryTotal: number };
  nextStepId: string | null;
  remaining: number;
  started: boolean;
};
export type FeatureStateInput = {
  steps: readonly Pick<FeatureStep, "ticketId" | "statusId" | "optional">[];
  blockingQuestions: ReadonlySet<string>;
  sprint: Pick<Sprint, "end"> | null;
  today: string;
};

export const DEFAULT_OPEN_LIMIT = 2;
const CLOSED_STATUSES: readonly FeatureStatus[] = ["todo", "delivered"];

const isStarted = (s: { statusId: FeatureStep["statusId"] }): boolean =>
  !NOT_STARTED_STATUSES.includes(s.statusId);
const isDone = (s: { statusId: FeatureStep["statusId"] }): boolean => FINAL_STATUSES.includes(s.statusId);

function statusOf(input: FeatureStateInput, remaining: number): FeatureStatus {
  if (remaining === 0) return "delivered";
  const next = input.steps.find((s) => !isDone(s));
  if (next !== undefined && (next.statusId === "blocked" || input.blockingQuestions.has(next.ticketId)))
    return "blocked";
  if (input.sprint !== null && input.sprint.end < input.today) return "late";
  return input.steps.some(isStarted) ? "open" : "todo";
}

export function featureState(input: FeatureStateInput): FeatureState {
  const mandatory = input.steps.filter((s) => !s.optional);
  const mandatoryDone = mandatory.filter(isDone).length;
  const remaining = mandatory.length - mandatoryDone;
  return {
    status: statusOf(input, remaining),
    steps: {
      done: input.steps.filter(isDone).length,
      total: input.steps.length,
      mandatoryDone,
      mandatoryTotal: mandatory.length,
    },
    nextStepId: input.steps.find((s) => !isDone(s))?.ticketId ?? null,
    remaining,
    started: input.steps.some(isStarted),
  };
}

export const isOpenFeature = (s: FeatureState): boolean => s.started && !CLOSED_STATUSES.includes(s.status);

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
