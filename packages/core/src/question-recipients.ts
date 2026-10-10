import {
  DEFAULT_RECIPIENTS,
  isOpen,
  KiboError,
  ME_RECIPIENT,
  type Question,
  QuestionRecipient,
  RECIPIENTS_MAX,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { getQuestion, listQuestions, storeQuestion } from "./questions";

type StoredRecipient = QuestionRecipient & { rank: number };

const recipientsMap = (doc: LoroDoc) => doc.getMap("questionRecipients");

function readStored(id: string, value: unknown): StoredRecipient {
  const parsed = QuestionRecipient.safeParse(value);
  const rank = typeof value === "object" && value !== null && "rank" in value ? value.rank : undefined;
  if (!parsed.success || typeof rank !== "number" || parsed.data.id !== id) {
    throw new KiboError("STORE_CORRUPT", `invalid question recipient ${id}`);
  }
  return { ...parsed.data, rank };
}

const defaults = (): StoredRecipient[] => DEFAULT_RECIPIENTS.map((r, rank) => ({ ...r, rank }));

function storedRecipients(doc: LoroDoc): StoredRecipient[] {
  const raw: Record<string, unknown> = recipientsMap(doc).toJSON();
  const stored = Object.entries(raw).map(([id, value]) => readStored(id, value));
  return stored.length > 0 ? stored.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)) : defaults();
}

const visible = ({ id, name }: StoredRecipient): QuestionRecipient => ({ id, name });

export function listQuestionRecipients(doc: LoroDoc): QuestionRecipient[] {
  return storedRecipients(doc).map(visible);
}

function materialize(doc: LoroDoc, stored: readonly StoredRecipient[]): void {
  if (recipientsMap(doc).size > 0) return;
  for (const r of stored) recipientsMap(doc).set(r.id, r);
}

function save(
  doc: LoroDoc,
  stored: readonly StoredRecipient[],
  recipient: StoredRecipient,
): QuestionRecipient {
  materialize(doc, stored);
  recipientsMap(doc).set(recipient.id, recipient);
  doc.commit();
  return visible(recipient);
}

function cleanRecipient(id: string, name: string, rank: number): StoredRecipient {
  const parsed = QuestionRecipient.safeParse({ id, name });
  if (!parsed.success) {
    throw new KiboError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "invalid question recipient");
  }
  return { ...parsed.data, rank };
}

function existing(stored: readonly StoredRecipient[], id: string): StoredRecipient {
  const found = stored.find((r) => r.id === id);
  if (!found) throw new KiboError("NOT_FOUND", `question recipient ${id} not found`);
  return found;
}

export function addQuestionRecipient(doc: LoroDoc, name: string, id: string): QuestionRecipient {
  const stored = storedRecipients(doc);
  if (stored.length >= RECIPIENTS_MAX) {
    throw new KiboError("QUOTA_EXCEEDED", `a project holds at most ${RECIPIENTS_MAX} question recipients`);
  }
  if (stored.some((r) => r.id === id)) throw new KiboError("CONFLICT", `question recipient ${id} exists`);
  const rank = Math.max(-1, ...stored.map((r) => r.rank)) + 1;
  return save(doc, stored, cleanRecipient(id, name, rank));
}

export function renameQuestionRecipient(doc: LoroDoc, id: string, name: string): QuestionRecipient {
  const stored = storedRecipients(doc);
  return save(doc, stored, cleanRecipient(id, name, existing(stored, id).rank));
}

export function removeQuestionRecipient(doc: LoroDoc, id: string): null {
  if (id === ME_RECIPIENT) throw new KiboError("INVALID_INPUT", "the recipient me cannot be removed");
  const stored = storedRecipients(doc);
  existing(stored, id);
  const open = listQuestions(doc).filter((q) => isOpen(q) && q.recipient === id).length;
  if (open > 0)
    throw new KiboError("CONFLICT", `question recipient ${id} is used by ${open} open question(s)`);
  materialize(doc, stored);
  recipientsMap(doc).delete(id);
  doc.commit();
  return null;
}

export function setQuestionRecipient(doc: LoroDoc, questionId: string, recipient: string): Question {
  const question = getQuestion(doc, questionId);
  if (!listQuestionRecipients(doc).some((r) => r.id === recipient)) {
    throw new KiboError("NOT_FOUND", `question recipient ${recipient} not found`);
  }
  return storeQuestion(doc, { ...question, recipient });
}

export function markQuestionSent(doc: LoroDoc, questionId: string, at: number): Question {
  const question = getQuestion(doc, questionId);
  return question.sentAt === null ? storeQuestion(doc, { ...question, sentAt: at }) : question;
}
