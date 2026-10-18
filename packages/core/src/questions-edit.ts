import {
  type Actor,
  isAnswered,
  isArchived,
  isDelivered,
  isEditableAnswer,
  KiboError,
  type ProjectCommand,
  pushEvent,
  QUESTIONS_PER_TICKET_MAX,
  type Question,
  type QuestionEventKind,
  type QuestionPrevious,
  resolveAnswer,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { nextQuestionSeq } from "./project";
import { assertRecipient } from "./question-recipients";
import { createQuestion, getQuestion, listQuestions, type NewQuestion, storeQuestion } from "./questions";
import { getNode } from "./tree";

type Command<M extends ProjectCommand["method"]> = Extract<ProjectCommand, { method: M }>;
type EditCommand = { questionId: string; by: Actor; at?: number };
type Change = Partial<Question>;

const EDITABLE_FIELDS = ["title", "context", "options", "provisional", "ticketId", "recipient"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

function record(
  doc: LoroDoc,
  question: Question,
  cmd: EditCommand,
  kind: QuestionEventKind,
  change: Change,
  previous: QuestionPrevious,
): Question {
  const event = { kind, at: cmd.at ?? Date.now(), by: cmd.by, previous };
  return storeQuestion(doc, { ...question, ...change, history: pushEvent(question.history, event) });
}

function refuse(id: string, reason: string): never {
  throw new KiboError("INVALID_TRANSITION", `question ${id} ${reason}`);
}

function assertNotArchived(q: Question): void {
  if (isArchived(q)) refuse(q.id, "is archived: restore it first");
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function changedFields(q: Question, cmd: Command<"updateQuestion">): EditableField[] {
  return EDITABLE_FIELDS.filter((field) => cmd[field] !== undefined && !same(cmd[field], q[field]));
}

type Fields = Partial<Pick<Question, EditableField>>;

function pick(source: Fields, fields: readonly EditableField[]): Fields {
  const picked: Fields = {};
  for (const field of fields) Object.assign(picked, { [field]: source[field] });
  return picked;
}

function assertTarget(doc: LoroDoc, ticketId: string): void {
  getNode(doc.getTree("tickets"), ticketId);
  const held = listQuestions(doc).filter((other) => other.ticketId === ticketId).length;
  if (held >= QUESTIONS_PER_TICKET_MAX) {
    throw new KiboError(
      "QUOTA_EXCEEDED",
      `ticket ${ticketId} already has ${QUESTIONS_PER_TICKET_MAX} questions`,
    );
  }
}

function assertProvisional(options: readonly string[], provisional: string | null): void {
  if (provisional !== null && options.length > 0 && !options.includes(provisional)) {
    throw new KiboError("INVALID_INPUT", "the provisional choice is not an option");
  }
}

export function updateQuestion(doc: LoroDoc, cmd: Command<"updateQuestion">): Question {
  const q = getQuestion(doc, cmd.questionId);
  assertNotArchived(q);
  if (isDelivered(q)) refuse(q.id, "has a delivered answer: reopen it first");
  const fields = changedFields(q, cmd);
  if (fields.length === 0) return q;
  if (isAnswered(q) && (fields.includes("options") || fields.includes("provisional"))) {
    refuse(q.id, "is answered: options and provisional are frozen, reopen it first");
  }
  const change = pick(cmd, fields);
  if (change.ticketId !== undefined) assertTarget(doc, change.ticketId);
  if (change.recipient !== undefined) assertRecipient(doc, change.recipient);
  assertProvisional(
    change.options ?? q.options,
    change.provisional === undefined ? q.provisional : change.provisional,
  );
  return record(doc, q, cmd, "updated", change, pick(q, fields));
}

export function updateAnswer(doc: LoroDoc, cmd: Command<"updateAnswer">): Question {
  const q = getQuestion(doc, cmd.questionId);
  if (!isEditableAnswer(q)) refuse(q.id, "has no answer that can still be edited");
  const at = cmd.at ?? Date.now();
  const answer = { ...resolveAnswer(q, cmd.answer), by: cmd.by, at, deliveredAt: null, deliveredRunId: null };
  return record(doc, q, { ...cmd, at }, "answer_edited", { answer }, { answer: q.answer });
}

export function reopenQuestion(doc: LoroDoc, cmd: Command<"reopenQuestion">): Question {
  const q = getQuestion(doc, cmd.questionId);
  assertNotArchived(q);
  if (!isAnswered(q)) refuse(q.id, "is already open");
  return record(doc, q, cmd, "reopened", { answer: null }, { answer: q.answer });
}

export function archiveQuestion(doc: LoroDoc, cmd: Command<"archiveQuestion">): Question {
  const q = getQuestion(doc, cmd.questionId);
  assertNotArchived(q);
  const at = cmd.at ?? Date.now();
  return record(doc, q, { ...cmd, at }, "archived", { archivedAt: at, archivedBy: cmd.by }, {});
}

export function restoreQuestion(doc: LoroDoc, cmd: Command<"restoreQuestion">): Question {
  const q = getQuestion(doc, cmd.questionId);
  if (!isArchived(q)) refuse(q.id, "is not archived");
  return record(doc, q, cmd, "restored", { archivedAt: null, archivedBy: null }, {});
}

export function remindQuestion(doc: LoroDoc, cmd: Command<"remindQuestion">): Question {
  const q = getQuestion(doc, cmd.questionId);
  assertNotArchived(q);
  if (isAnswered(q)) refuse(q.id, "is answered: nothing to remind");
  return record(doc, q, cmd, "reminded", {}, {});
}

export function createNumberedQuestion(doc: LoroDoc, input: NewQuestion): Question {
  const known = doc.getMap("questions").size;
  const question = createQuestion(doc, input);
  if (doc.getMap("questions").size === known) return question;
  return storeQuestion(doc, { ...question, number: nextQuestionSeq(doc) });
}

const distinct = (ids: readonly string[]): string[] => [...new Set(ids)];

export function markQuestionsExported(doc: LoroDoc, cmd: Command<"markQuestionsExported">): Question[] {
  const marked = distinct(cmd.questionIds).map((id) => getQuestion(doc, id));
  const archived = marked.find(isArchived);
  if (archived) throw new KiboError("INVALID_INPUT", `question ${archived.id} is archived`);
  const at = cmd.at ?? Date.now();
  return marked.map((q) => record(doc, q, { questionId: q.id, by: cmd.by, at }, "exported", {}, {}));
}

function withoutLastExport(history: Question["history"]): Question["history"] {
  const last = history.map((event) => event.kind).lastIndexOf("exported");
  return last === -1 ? [...history] : history.filter((_, index) => index !== last);
}

export function unmarkQuestionsExported(doc: LoroDoc, cmd: Command<"unmarkQuestionsExported">): Question[] {
  return distinct(cmd.questionIds).map((id) => {
    const q = getQuestion(doc, id);
    const history = withoutLastExport(q.history);
    return history.length === q.history.length ? q : storeQuestion(doc, { ...q, history });
  });
}
