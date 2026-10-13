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
import { assertRecipient } from "./question-recipients";
import { getQuestion, listQuestions, storeQuestion } from "./questions";
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
