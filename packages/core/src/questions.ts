import {
  type Actor,
  type AnswerInput,
  type ImportRef,
  isOpen,
  KiboError,
  QUESTIONS_PER_TICKET_MAX,
  Question,
  resolveAnswer,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { getNode } from "./tree";

export type NewQuestion = {
  ticketId: string;
  title: string;
  context?: string;
  options?: readonly string[];
  provisional?: string | null;
  blocking?: boolean;
  runId?: string | null;
  createdBy: Actor;
  importRef?: ImportRef | null;
  at?: number;
};

const questions = (doc: LoroDoc) => doc.getMap("questions");

function readQuestion(id: string, raw: unknown): Question {
  const parsed = Question.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid question ${id}`);
  return parsed.data;
}

const byCreation = (a: Question, b: Question): number =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

export function listQuestions(doc: LoroDoc): Question[] {
  const raw: Record<string, unknown> = questions(doc).toJSON();
  return Object.entries(raw)
    .map(([id, value]) => readQuestion(id, value))
    .sort(byCreation);
}

function getQuestion(doc: LoroDoc, id: string): Question {
  const raw: unknown = questions(doc).get(id);
  if (raw === undefined) throw new KiboError("NOT_FOUND", `question ${id} not found`);
  return readQuestion(id, raw);
}

function store(doc: LoroDoc, candidate: unknown): Question {
  const parsed = Question.safeParse(candidate);
  if (!parsed.success) {
    throw new KiboError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "invalid question");
  }
  questions(doc).set(parsed.data.id, parsed.data);
  doc.commit();
  return parsed.data;
}

export function createQuestion(doc: LoroDoc, input: NewQuestion): Question {
  getNode(doc.getTree("tickets"), input.ticketId);
  const title = input.title.trim();
  const ofTicket = listQuestions(doc).filter((q) => q.ticketId === input.ticketId);
  const same = ofTicket.find((q) => isOpen(q) && q.title === title);
  if (same) return same;
  if (ofTicket.length >= QUESTIONS_PER_TICKET_MAX) {
    throw new KiboError(
      "QUOTA_EXCEEDED",
      `ticket ${input.ticketId} already has ${QUESTIONS_PER_TICKET_MAX} questions`,
    );
  }
  return store(doc, {
    id: crypto.randomUUID(),
    ticketId: input.ticketId,
    runId: input.runId ?? null,
    title,
    context: input.context ?? "",
    options: [...(input.options ?? [])],
    provisional: input.provisional ?? null,
    blocking: input.blocking ?? false,
    createdBy: input.createdBy,
    createdAt: input.at ?? Date.now(),
    importRef: input.importRef ?? null,
    answer: null,
  });
}

export function answerQuestion(
  doc: LoroDoc,
  id: string,
  input: AnswerInput,
  by: Actor,
  at: number,
): Question {
  const question = getQuestion(doc, id);
  if (!isOpen(question)) throw new KiboError("INVALID_TRANSITION", `question ${id} is already answered`);
  return store(doc, { ...question, answer: { ...resolveAnswer(question, input), by, at } });
}

export function removeQuestion(doc: LoroDoc, id: string): void {
  if (questions(doc).get(id) === undefined) throw new KiboError("NOT_FOUND", `question ${id} not found`);
  questions(doc).delete(id);
  doc.commit();
}

const ticketOf = (raw: unknown): unknown =>
  typeof raw === "object" && raw !== null && "ticketId" in raw ? raw.ticketId : undefined;

export function pruneQuestions(doc: LoroDoc, ticketIds: readonly string[]): void {
  const gone = new Set<unknown>(ticketIds);
  const raw: Record<string, unknown> = questions(doc).toJSON();
  for (const [id, value] of Object.entries(raw)) if (gone.has(ticketOf(value))) questions(doc).delete(id);
  doc.commit();
}

export function openQuestionCount(doc: LoroDoc, ticketId: string): number {
  return listQuestions(doc).filter((q) => q.ticketId === ticketId && isOpen(q)).length;
}

export function openCountByTicket(all: readonly Question[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of all) if (isOpen(q)) counts.set(q.ticketId, (counts.get(q.ticketId) ?? 0) + 1);
  return counts;
}
