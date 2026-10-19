import {
  type CiRun,
  type CiTone,
  findRecipient,
  isOpen,
  liveReview,
  type ProjectEvent,
  prCiTone,
  type Question,
  type QuestionRecipient,
  reviewCards,
  type TicketView,
} from "@kibo/schema";
import { featureKeyOf, relativeAge } from "./overview-facts";

export type ReviewState = "changes" | CiTone | null;
export type ReviewRow = {
  number: number;
  url: string;
  ticketId: string;
  title: string;
  key: string;
  feature: string | null;
  state: ReviewState;
};
export type QuestionRow = {
  id: string;
  title: string;
  feature: string | null;
  meta: string;
  blocking: boolean;
};

const PR_KINDS: readonly ProjectEvent["kind"][] = ["pr_opened", "pr_review", "pr_checks", "pr_merged"];

function lastPrEvents(tickets: readonly TicketView[], events: readonly ProjectEvent[]): Map<string, number> {
  const last = new Map<string, number>();
  for (const e of events)
    if (e.ticketId !== null && PR_KINDS.includes(e.kind))
      last.set(e.ticketId, Math.max(last.get(e.ticketId) ?? e.at, e.at));
  for (const t of tickets) if (!last.has(t.id) && t.updatedAt !== null) last.set(t.id, t.updatedAt);
  return last;
}

export function reviewRows(input: {
  tickets: readonly TicketView[];
  events: readonly ProjectEvent[];
  ciRuns: readonly CiRun[];
}): ReviewRow[] {
  return reviewCards(input.tickets, lastPrEvents(input.tickets, input.events)).map(
    ({ pr, ticket, feature }) => ({
      number: pr.number,
      url: pr.url,
      ticketId: ticket.id,
      title: ticket.title,
      key: ticket.keyLabel,
      feature: feature?.shortKey ?? null,
      state: liveReview(pr) === "changes_requested" ? "changes" : prCiTone(pr, input.ciRuns),
    }),
  );
}

export function questionRows(input: {
  tickets: readonly TicketView[];
  questions: readonly Question[];
  recipients: readonly QuestionRecipient[];
  now: number;
}): QuestionRow[] {
  const byId = new Map(input.tickets.map((t) => [t.id, t]));
  const open = input.questions.filter(isOpen);
  return [...open.filter((q) => q.blocking), ...open.filter((q) => !q.blocking)].map((q) => ({
    id: q.id,
    title: q.title,
    feature: featureKeyOf(q.ticketId, byId),
    meta: [
      q.importRef?.id ?? null,
      findRecipient(input.recipients, q.recipient)?.name ?? null,
      relativeAge(q.createdAt, input.now),
    ]
      .filter((part): part is string => part !== null)
      .join(" · "),
    blocking: q.blocking,
  }));
}

export const QUESTION_PAGE = 5;

export function questionPage(
  rows: readonly QuestionRow[],
  shown: number,
): { rows: readonly QuestionRow[]; more: number } {
  return { rows: rows.slice(0, shown), more: Math.max(0, rows.length - shown) };
}
