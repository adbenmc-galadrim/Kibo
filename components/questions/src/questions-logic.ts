import { type AnswerInput, isOpen, type Question, type TicketView, undeliveredAnswers } from "@kibo/schema";
import { fr } from "./fr";

export type Scope = "open" | "answered" | "all";
export type AnswerForm = { option: string | null; text: string; confirm: boolean };
export type TicketGroup = { ticket: TicketView; questions: Question[] };
export type ViewGroup = TicketGroup & { undelivered: Question[] };

const inScope = (q: Question, scope: Scope): boolean => scope === "all" || (scope === "open") === isOpen(q);

export function filterQuestions(
  questions: readonly Question[],
  scope: Scope,
  ticketId: string | null,
): Question[] {
  return questions.filter((q) => inScope(q, scope) && (ticketId === null || q.ticketId === ticketId));
}

export const byNewest = (a: Question, b: Question): number => b.createdAt - a.createdAt;

const byKey = (a: TicketView, b: TicketView): number =>
  a.keyLabel.localeCompare(b.keyLabel, "fr", { numeric: true });

export function groupByTicket(questions: readonly Question[], tickets: readonly TicketView[]): TicketGroup[] {
  return [...tickets]
    .sort(byKey)
    .map((ticket) => ({
      ticket,
      questions: questions.filter((q) => q.ticketId === ticket.id).sort(byNewest),
    }))
    .filter((g) => g.questions.length > 0);
}

export function viewGroups(
  questions: readonly Question[],
  tickets: readonly TicketView[],
  scope: Scope,
  ticketId: string | null,
): ViewGroup[] {
  const shown = filterQuestions(questions, scope, ticketId);
  return [...tickets]
    .filter((t) => ticketId === null || t.id === ticketId)
    .sort(byKey)
    .map((ticket) => ({
      ticket,
      questions: shown.filter((q) => q.ticketId === ticket.id).sort(byNewest),
      undelivered: undeliveredAnswers(questions, ticket.id),
    }))
    .filter((g) => g.questions.length > 0 || g.undelivered.length > 0);
}

export function answerFrom(form: AnswerForm): AnswerInput | null {
  if (form.confirm) return { kind: "confirm" };
  if (form.option !== null) return { kind: "option", option: form.option };
  const text = form.text.trim();
  return text === "" ? null : { kind: "text", text };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeAge(at: number, now: number): string {
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return fr.age.now;
  if (elapsed < HOUR) return fr.age.minutes(Math.floor(elapsed / MINUTE));
  if (elapsed < DAY) return fr.age.hours(Math.floor(elapsed / HOUR));
  return fr.age.days(Math.floor(elapsed / DAY));
}
