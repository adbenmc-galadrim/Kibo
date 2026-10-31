import {
  type Actor,
  type AnswerInput,
  isAnswered,
  isArchived,
  isOpen,
  openCountByRecipient,
  type Question,
  type QuestionRecipient,
} from "@kibo/schema";
import { humanName } from "@kibo/sdk";
import { fr } from "./fr";

export type Scope = "open" | "answered" | "all" | "archived";
export type AnswerForm = { option: string | null; text: string; confirm: boolean };

const SCOPE_TEST: Record<Scope, (q: Question) => boolean> = {
  open: isOpen,
  answered: isAnswered,
  all: (q) => !isArchived(q),
  archived: isArchived,
};

const inScope = (q: Question, scope: Scope): boolean => SCOPE_TEST[scope](q);

export const scopeFor = (q: Question): Scope => (isArchived(q) ? "archived" : "all");

export function canArchive(q: Question, viewer: string): boolean {
  if (isArchived(q)) return false;
  if (!isOpen(q)) return true;
  return q.createdBy.kind === "human" && q.createdBy.ref === viewer;
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

const byNewest = (a: Question, b: Question): number => b.createdAt - a.createdAt;

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

export function shortAge(at: number, now: number): string {
  const elapsed = Math.max(0, now - at);
  if (elapsed < HOUR) return fr.age.short.minutes(Math.max(1, Math.floor(elapsed / MINUTE)));
  if (elapsed < DAY) return fr.age.short.hours(Math.floor(elapsed / HOUR));
  return fr.age.short.days(Math.floor(elapsed / DAY));
}

export function askedAge(at: number, now: number): string {
  const days = Math.floor(Math.max(0, now - at) / DAY);
  return days === 1 ? fr.age.yesterday : relativeAge(at, now);
}

export function lastReminder(q: Question): number | null {
  if (q.answer !== null) return null;
  const reminders = q.history.filter((e) => e.kind === "reminded").map((e) => e.at);
  return reminders.length > 0 ? Math.max(...reminders) : null;
}

export const actorName = (actor: Actor): string => {
  if (actor.kind === "import") return fr.imported(actor.ref);
  return actor.kind === "human" ? humanName(actor.ref, fr.unknownMember) : actor.ref;
};
