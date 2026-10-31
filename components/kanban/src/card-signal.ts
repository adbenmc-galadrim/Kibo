import {
  type GithubPrRef,
  liveReview,
  type OnHold,
  type Question,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { ticketPr } from "./ticket-pr";

type BlockingQuestion = Pick<Question, "number" | "importRef">;

export type CardSignal =
  | { kind: "blocked"; question: BlockingQuestion | null }
  | { kind: "changes" }
  | { kind: "held"; hold: OnHold }
  | { kind: "waiting"; keys: readonly string[] };

type SignalTicket = Pick<TicketView, "externalRefs" | "onHold" | "waitingOn" | "startReason">;

export function waitedKeys(ticket: Pick<TicketView, "waitingOn" | "startReason">): readonly string[] {
  const reason = ticket.startReason;
  const fromReason = reason?.kind === "dependency" ? reason.keys : [];
  return [...new Set([...ticket.waitingOn, ...fromReason])];
}

export function cardSignal(
  ticket: SignalTicket,
  blocked: boolean,
  blocking: BlockingQuestion | null,
): CardSignal | null {
  if (blocked) return { kind: "blocked", question: blocking };
  const pr = ticketPr(ticket);
  if (pr !== null && liveReview(pr) === "changes_requested") return { kind: "changes" };
  if (ticket.onHold !== null) return { kind: "held", hold: ticket.onHold };
  const keys = waitedKeys(ticket);
  return keys.length > 0 ? { kind: "waiting", keys } : null;
}

const PROGRESS_STATUSES: readonly StatusId[] = ["in_progress", "in_review"];

type CardProgress = { pr: GithubPrRef; delivery: TicketView["delivery"] };

export function cardProgress(
  ticket: Pick<TicketView, "statusId" | "externalRefs" | "delivery">,
): CardProgress | null {
  if (!PROGRESS_STATUSES.includes(ticket.statusId)) return null;
  const pr = ticketPr(ticket);
  return pr === null ? null : { pr, delivery: ticket.delivery };
}
