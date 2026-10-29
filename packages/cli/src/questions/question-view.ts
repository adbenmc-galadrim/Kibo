import {
  findRecipient,
  isArchived,
  ME_RECIPIENT,
  type ProjectSnapshot,
  type Question,
  type QuestionAnswer,
} from "@kibo/schema";

export type QuestionState = "open" | "answered" | "archived";

export type QuestionSummary = {
  id: string;
  number: number | null;
  ticket: string;
  title: string;
  state: QuestionState;
  blocking: boolean;
  recipient: { id: string; name: string };
  options: string[];
  provisional: string | null;
  answer: string | null;
  createdAt: number;
};

const ME_NAME = "moi";

const stateOf = (q: Question): QuestionState =>
  isArchived(q) ? "archived" : q.answer !== null ? "answered" : "open";

const answerText = (answer: QuestionAnswer | null): string | null =>
  answer === null ? null : (answer.option ?? answer.text);

function recipientOf(snapshot: ProjectSnapshot, id: string): QuestionSummary["recipient"] {
  const known = findRecipient(snapshot.questionRecipients, id);
  if (known) return { id: known.id, name: known.name };
  return { id, name: id === ME_RECIPIENT ? ME_NAME : id };
}

const byNumber = (a: Question, b: Question): number =>
  (a.number ?? Number.POSITIVE_INFINITY) - (b.number ?? Number.POSITIVE_INFINITY) ||
  a.createdAt - b.createdAt;

export function summarizeQuestions(
  snapshot: ProjectSnapshot,
  ticketId: string,
  all: boolean,
): QuestionSummary[] {
  const ticket = snapshot.tickets.find((t) => t.id === ticketId)?.keyLabel ?? ticketId;
  return snapshot.questions
    .filter((q) => q.ticketId === ticketId && (all || !isArchived(q)))
    .sort(byNumber)
    .map((q) => ({
      id: q.id,
      number: q.number,
      ticket,
      title: q.title,
      state: stateOf(q),
      blocking: q.blocking,
      recipient: recipientOf(snapshot, q.recipient),
      options: q.options,
      provisional: q.provisional,
      answer: answerText(q.answer),
      createdAt: q.createdAt,
    }));
}

const NUMBER = /^#?([1-9]\d*)$/;

export function findQuestion(questions: readonly Question[], ident: string): Question | null {
  const raw = ident.trim();
  const number = NUMBER.exec(raw)?.[1];
  const byNumber = number === undefined ? undefined : questions.find((q) => q.number === Number(number));
  return byNumber ?? questions.find((q) => q.id === raw) ?? null;
}
