import { join } from "node:path";
import {
  isArchived,
  isDelivered,
  isOpen,
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
export type NotesSource = { dir: string; notes: NoteMeta[] };
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

export const briefNotePath = (planId: string): string => `briefs/${planId}.md`;

export function detailExtras(
  ticket: TicketIdentity,
  questions: QuestionsSource,
  notes: NotesSource,
): DetailExtras {
  const briefPath = ticket.planId === null ? null : briefNotePath(ticket.planId);
  return {
    questions: questionSummaries(ticket.id, questions),
    notes: notes.notes
      .filter((n) => n.tickets.includes(ticket.key))
      .map((n) => ({ path: n.path, title: n.title })),
    brief:
      briefPath !== null && notes.notes.some((n) => n.path === briefPath) ? join(notes.dir, briefPath) : null,
  };
}
