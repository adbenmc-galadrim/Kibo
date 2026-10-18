import type { GithubPrRef } from "./external-ref";
import type { FeatureStep } from "./feature-steps";
import { addDays, dayNumber, isoWeekday } from "./iso-date";
import type { Sprint } from "./sprint";
import { isSprintRunning } from "./sprint-phase";
import { FINAL_STATUSES } from "./startable";

export type AtRiskStep = Pick<FeatureStep, "statusId" | "optional"> & {
  pr: Pick<GithubPrRef, "review"> | null;
};
export type AtRiskFeature = { sprint: Pick<Sprint, "start" | "end"> | null; steps: readonly AtRiskStep[] };

const SATURDAY = 6;

export function workingDaysLeft(sprint: Pick<Sprint, "start" | "end">, today: string): number {
  const from = today > sprint.start ? today : sprint.start;
  const span = dayNumber(sprint.end) - dayNumber(from) + 1;
  return Array.from({ length: Math.max(0, span) }, (_, i) => addDays(from, i)).filter(
    (day) => isoWeekday(day) < SATURDAY,
  ).length;
}

const isLeft = (step: AtRiskStep): boolean => !FINAL_STATUSES.includes(step.statusId);
const changesRequested = (step: AtRiskStep): boolean =>
  isLeft(step) && step.pr?.review === "changes_requested";

export function atRisk(feature: AtRiskFeature, today: string): boolean {
  const { sprint } = feature;
  if (sprint === null || !isSprintRunning(sprint, today)) return false;
  const mandatoryLeft = feature.steps.filter((s) => !s.optional && isLeft(s)).length;
  if (mandatoryLeft > workingDaysLeft(sprint, today)) return true;
  return sprint.end === today && feature.steps.some(changesRequested);
}
