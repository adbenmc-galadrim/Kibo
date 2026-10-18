import {
  type AnswerInput,
  answersToDeliver,
  isAnswered,
  isArchived,
  isOpen,
  isTerminal,
  openCountByRecipient,
  type Question,
  type QuestionRecipient,
  type TicketRun,
  type TicketView,
} from "@kibo/schema";
import { fr } from "./fr";

export type Scope = "open" | "answered" | "all" | "archived";
export type AnswerForm = { option: string | null; text: string; confirm: boolean };
export type TicketGroup = { ticket: TicketView; questions: Question[] };
export type ViewGroup = TicketGroup & { undelivered: Question[] };

const SCOPE_TEST: Record<Scope, (q: Question) => boolean> = {
  open: isOpen,
  answered: isAnswered,
  all: (q) => !isArchived(q),
  archived: isArchived,
};

const inScope = (q: Question, scope: Scope): boolean => SCOPE_TEST[scope](q);

export const scopeFor = (q: Question): Scope => (isArchived(q) ? "archived" : "all");

const activeRun = (run: TicketRun | null): boolean => run !== null && !isTerminal(run.state);

export function canArchive(q: Question, viewer: string, run: TicketRun | null): boolean {
  if (isArchived(q)) return false;
  if (!isOpen(q)) return true;
  return q.createdBy.kind === "human" && q.createdBy.ref === viewer && !activeRun(run);
}

export type RecipientCounts = { total: number; byRecipient: Map<string, number> };

export function filterQuestions(
  questions: readonly Question[],
  scope: Scope,
  ticketId: string | null,
  recipient: string | null = null,
): Question[] {
  return questions.filter(
    (q) =>
      inScope(q, scope) &&
      (ticketId === null || q.ticketId === ticketId) &&
      (recipient === null || q.recipient === recipient),
  );
}

export function recipientCounts(questions: readonly Question[]): RecipientCounts {
  const byRecipient = openCountByRecipient(questions);
  let total = 0;
  for (const n of byRecipient.values()) total += n;
  return { total, byRecipient };
}

export const CLIENT_RECIPIENT = "client";

export const recipientName = (
  recipients: readonly QuestionRecipient[],
  id: string,
  client: string | null = null,
): string =>
  id === CLIENT_RECIPIENT && client !== null
    ? client
    : (recipients.find((r) => r.id === id)?.name ?? fr.removedRecipient);

export const isOpenBlocking = (q: Question): boolean => q.blocking && isOpen(q);

export const blockingFirst = (a: Question, b: Question): number =>
  Number(isOpenBlocking(b)) - Number(isOpenBlocking(a)) || byNewest(a, b);

export function blockingSummary(shown: readonly Question[]): { blocking: number; open: number } {
  return { blocking: shown.filter(isOpenBlocking).length, open: shown.filter(isOpen).length };
}

export function lastExportedAt(q: Question): number | null {
  const exports = q.history.filter((e) => e.kind === "exported").map((e) => e.at);
  return exports.length > 0 ? Math.max(...exports) : q.sentAt;
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

const leadsWithBlocking = (g: TicketGroup): number => Number(g.questions.some(isOpenBlocking));

export function viewGroups(
  questions: readonly Question[],
  tickets: readonly TicketView[],
  scope: Scope,
  ticketId: string | null,
  recipient: string | null = null,
): ViewGroup[] {
  const shown = filterQuestions(questions, scope, ticketId, recipient);
  return [...tickets]
    .filter((t) => ticketId === null || t.id === ticketId)
    .sort(byKey)
    .map((ticket) => ({
      ticket,
      questions: shown.filter((q) => q.ticketId === ticket.id).sort(blockingFirst),
      undelivered: answersToDeliver(questions, ticket.id),
    }))
    .filter((g) => g.questions.length > 0)
    .sort((a, b) => leadsWithBlocking(b) - leadsWithBlocking(a));
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

export function lastReminder(q: Question): number | null {
  if (q.answer !== null) return null;
  const reminders = q.history.filter((e) => e.kind === "reminded").map((e) => e.at);
  return reminders.length > 0 ? Math.max(...reminders) : null;
}
