import type { FeatureStep } from "./feature-steps";
import { NOT_STARTED_STATUSES } from "./startable";

type StepFacts = Pick<FeatureStep, "ticketId" | "statusId" | "optional" | "pr">;

const isDeliverable = (s: StepFacts): boolean =>
  NOT_STARTED_STATUSES.includes(s.statusId) ||
  (s.statusId === "in_review" && s.pr?.review === "changes_requested");

export const nextDeliverableStep = (steps: readonly StepFacts[]): string | null =>
  steps.find(isDeliverable)?.ticketId ?? null;
