import {
  type ListQuestionsInput,
  type ListTicketsInput,
  PAGE_SIZE,
  type ProjectOverview,
  type ProjectSnapshot,
  type QueueEntry,
  type RunState,
  type RunView,
  type TicketCard,
  type ToolPage,
} from "@kibo/schema";
import { ticketCard } from "./ticket-card";
import { answerText, ticketKeyOf } from "./ticket-facts";

export function pageOf<T>(items: readonly T[], cursor: string | undefined, size = PAGE_SIZE): ToolPage<T> {
  const offset = cursor === undefined ? 0 : Number(cursor);
  const end = offset + size;
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? String(end) : null,
    total: items.length,
  };
}

const matchesQuery = (card: TicketCard, query: string | undefined): boolean => {
  const needle = query?.trim().toLowerCase();
  if (!needle) return true;
  return card.key.toLowerCase().includes(needle) || card.title.toLowerCase().includes(needle);
};

export function listTickets(project: ProjectSnapshot, input: ListTicketsInput): ToolPage<TicketCard> {
  const cards = project.tickets
    .filter((t) => input.status === undefined || t.statusId === input.status)
    .filter((t) => input.label === undefined || t.labels.includes(input.label))
    .map((t) => ticketCard(project, t))
    .filter((c) => matchesQuery(c, input.query));
  return pageOf(cards, input.cursor);
}

export type QuestionLine = {
  id: string;
  ticket: string;
  title: string;
  state: "open" | "answered";
  blocking: boolean;
  answer: string | null;
};

export function listQuestions(project: ProjectSnapshot, input: ListQuestionsInput): QuestionLine[] {
  return project.questions
    .map((q) => ({
      id: q.id,
      ticket: ticketKeyOf(project, q.ticketId),
      title: q.title,
      state: q.answer === null ? ("open" as const) : ("answered" as const),
      blocking: q.blocking,
      answer: answerText(q),
    }))
    .filter((q) => input.state === "all" || q.state === input.state)
    .filter((q) => input.ticketKey === undefined || q.ticket === input.ticketKey);
}

export function listRuns(
  runs: readonly RunView[],
  queue: readonly QueueEntry[],
  projectId: string,
  state?: RunState,
): ProjectOverview["runs"] {
  return runs
    .filter((r) => r.projectId === projectId && r.kind === "ticket")
    .filter((r) => state === undefined || r.state === state)
    .map((r) => ({
      id: r.id,
      label: r.label,
      state: r.state,
      subject: r.ticketKey ?? r.ticketTitle,
      position: queue.find((q) => q.runId === r.id)?.position ?? null,
    }));
}

export const compactJson = (value: unknown): string => JSON.stringify(value);
