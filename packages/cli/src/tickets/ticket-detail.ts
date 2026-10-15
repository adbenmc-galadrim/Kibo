import { join } from "node:path";
import {
  isArchived,
  isDelivered,
  isOpen,
  KiboError,
  type NoteMeta,
  type Question,
  type QuestionRecipient,
} from "@kibo/schema";

export type QuestionSummary = {
  id: string;
  title: string;
  recipient: { id: string; name: string };
  state: "open" | "answered";
  blocking: boolean;
};
export type NoteSummary = { path: string; title: string };
export type DetailExtras = { questions: QuestionSummary[]; notes: NoteSummary[]; brief: string | null };
export type QuestionsSource = { questions: Question[]; questionRecipients: QuestionRecipient[] };
type TicketIdentity = { id: string; key: string; planId: string | null };

const isPending = (q: Question): boolean => !isArchived(q) && !isDelivered(q);

function questionSummaries(ticketId: string, source: QuestionsSource): QuestionSummary[] {
  const names = new Map(source.questionRecipients.map((r) => [r.id, r.name]));
  return source.questions
    .filter((q) => q.ticketId === ticketId && isPending(q))
    .map((q) => ({
      id: q.id,
      title: q.title,
      recipient: { id: q.recipient, name: names.get(q.recipient) ?? q.recipient },
      state: isOpen(q) ? "open" : "answered",
      blocking: q.blocking,
    }));
}

export const briefFile = (notesDir: string, planId: string | null): string | null =>
  planId === null ? null : join(notesDir, "briefs", `${planId}.md`);

export function detailExtras(
  ticket: TicketIdentity,
  questions: QuestionsSource,
  notes: readonly NoteMeta[],
  brief: string | null,
): DetailExtras {
  return {
    questions: questionSummaries(ticket.id, questions),
    notes: notes.filter((n) => n.tickets.includes(ticket.key)).map((n) => ({ path: n.path, title: n.title })),
    brief,
  };
}

const isUnknownMethod = (e: unknown): boolean =>
  e instanceof KiboError && e.code === "INVALID_INPUT" && e.detail === "invalid request: method";

export async function notesOrEmpty(load: () => Promise<NoteMeta[]>, warn: () => void): Promise<NoteMeta[]> {
  try {
    return await load();
  } catch (e) {
    if (!isUnknownMethod(e)) throw e;
    warn();
    return [];
  }
}
