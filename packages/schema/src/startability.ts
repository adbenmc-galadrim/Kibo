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
  feature: { id: string; sprint: Pick<Sprint, "code" | "start"> | null } | null;
};
export type StartContext = { today: string; limit: number; inProgressFeatures: ReadonlySet<string> };
export type StartReason =
  | { kind: "status" }
  | { kind: "dependency"; keys: string[] }
  | { kind: "question"; label: string }
  | { kind: "sprint"; code: string }
  | { kind: "unplanned" }
  | { kind: "limit"; limit: number };
export type Startability = { startable: true } | { startable: false; reason: StartReason };

const START: Startability = { startable: true };
const refuse = (reason: StartReason): Startability => ({ startable: false, reason });

function featureReason(feature: NonNullable<StartFacts["feature"]>, ctx: StartContext): StartReason | null {
  if (feature.sprint === null) return { kind: "unplanned" };
  if (feature.sprint.start > ctx.today) return { kind: "sprint", code: feature.sprint.code };
  const full = ctx.inProgressFeatures.size >= ctx.limit;
  return full && !ctx.inProgressFeatures.has(feature.id) ? { kind: "limit", limit: ctx.limit } : null;
}

export function startable(ticket: StartFacts, ctx: StartContext): Startability {
  if (!NOT_STARTED_STATUSES.includes(ticket.statusId) || ticket.busy) return refuse({ kind: "status" });
  const waiting = ticket.blockers.filter((b) => !FINAL_STATUSES.includes(b.statusId)).map((b) => b.key);
  if (waiting.length > 0) return refuse({ kind: "dependency", keys: waiting });
  if (ticket.blockingQuestion !== null)
    return refuse({ kind: "question", label: questionLabel(ticket.blockingQuestion) });
  const reason = ticket.feature === null ? null : featureReason(ticket.feature, ctx);
  return reason === null ? START : refuse(reason);
}
