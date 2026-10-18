import type { FeatureStep } from "./feature-steps";
import type { Question } from "./question";
import { questionLabel } from "./question-label";
import type { Sprint } from "./sprint";
import { FINAL_STATUSES, NOT_STARTED_STATUSES } from "./startable";
import type { StatusId } from "./status";

export type StartFacts = {
  statusId: StatusId;
  busy: boolean;
  blockers: readonly { key: string; statusId: StatusId }[];
  blockingQuestion: Pick<Question, "number" | "importRef"> | null;
  feature: {
    id: string;
    sprint: Pick<Sprint, "code" | "start"> | null;
    waitingSteps: readonly string[];
  } | null;
};
export type StartContext = {
  today: string;
  limit: number;
  inProgressFeatures: ReadonlySet<string>;
  planned: boolean;
};
export type StartReason =
  | { kind: "status" }
  | { kind: "dependency"; keys: string[] }
  | { kind: "question"; label: string }
  | { kind: "sprint"; code: string }
  | { kind: "unplanned" }
  | { kind: "limit"; limit: number };
type StartFeatureSprint = NonNullable<StartFacts["feature"]>["sprint"];
export type Startability = { startable: true } | { startable: false; reason: StartReason };

const START: Startability = { startable: true };
const refuse = (reason: StartReason): Startability => ({ startable: false, reason });

function sprintReason(sprint: StartFeatureSprint, ctx: StartContext): StartReason | null {
  if (!ctx.planned) return null;
  if (sprint === null) return { kind: "unplanned" };
  return sprint.start > ctx.today ? { kind: "sprint", code: sprint.code } : null;
}

function featureReason(feature: NonNullable<StartFacts["feature"]>, ctx: StartContext): StartReason | null {
  const waiting = sprintReason(feature.sprint, ctx);
  if (waiting !== null) return waiting;
  const full = ctx.inProgressFeatures.size >= ctx.limit;
  return full && !ctx.inProgressFeatures.has(feature.id) ? { kind: "limit", limit: ctx.limit } : null;
}

export type StepFacts = Pick<FeatureStep, "ticketId" | "key" | "statusId" | "optional">;

export function lastStepWaitsOn(ticketId: string, steps: readonly StepFacts[]): string[] {
  if (steps.length < 2 || steps.at(-1)?.ticketId !== ticketId) return [];
  return steps
    .slice(0, -1)
    .filter((s) => !s.optional && !FINAL_STATUSES.includes(s.statusId))
    .map((s) => s.key);
}

function waitingOf(ticket: StartFacts): string[] {
  const blockers = ticket.blockers.filter((b) => !FINAL_STATUSES.includes(b.statusId)).map((b) => b.key);
  return [...new Set([...blockers, ...(ticket.feature?.waitingSteps ?? [])])];
}

export function startable(ticket: StartFacts, ctx: StartContext): Startability {
  if (!NOT_STARTED_STATUSES.includes(ticket.statusId) || ticket.busy) return refuse({ kind: "status" });
  const waiting = waitingOf(ticket);
  if (waiting.length > 0) return refuse({ kind: "dependency", keys: waiting });
  if (ticket.blockingQuestion !== null)
    return refuse({ kind: "question", label: questionLabel(ticket.blockingQuestion) });
  const reason = ticket.feature === null ? null : featureReason(ticket.feature, ctx);
  return reason === null ? START : refuse(reason);
}
