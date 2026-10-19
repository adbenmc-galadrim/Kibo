import {
  findRecipient,
  isArchived,
  isOpenSignal,
  KiboError,
  type ListQuestionsInput,
  type ListSignalsInput,
  type ListTicketsInput,
  PAGE_SIZE,
  type ProjectOverview,
  type ProjectSnapshot,
  type Question,
  type QueueEntry,
  type RunState,
  type RunView,
  type Signal,
  type SignalLine,
  signalLine,
  type TicketCard,
  type ToolPage,
} from "@kibo/schema";
import { ticketCard } from "./ticket-card";
import { answerText, questionState, ticketKeyOf } from "./ticket-facts";

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

export type QuestionState = "open" | "answered" | "archived";

export type QuestionLine = {
  id: string;
  ticket: string;
  title: string;
  state: QuestionState;
  blocking: boolean;
  answer: string | null;
  recipient: string;
  recipientName: string;
  sentAt: number | null;
};

const stateOf = (q: Question): QuestionState => (isArchived(q) ? "archived" : questionState(q));

const inQuestionState = (state: QuestionState, wanted: ListQuestionsInput["state"]): boolean =>
  wanted === "all" ? state !== "archived" : state === wanted;

function recipientFilter(project: ProjectSnapshot, raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const found = findRecipient(project.questionRecipients, raw.trim());
  if (found) return found.id;
  const names = project.questionRecipients.map((r) => r.name).join(", ");
  throw new KiboError(
    "INVALID_INPUT",
    `destinataire inconnu « ${raw} » ; destinataires du projet : ${names}`,
  );
}

function questionLine(project: ProjectSnapshot, q: Question): QuestionLine {
  return {
    id: q.id,
    ticket: ticketKeyOf(project, q.ticketId),
    title: q.title,
    state: stateOf(q),
    blocking: q.blocking,
    answer: answerText(q),
    recipient: q.recipient,
    recipientName: findRecipient(project.questionRecipients, q.recipient)?.name ?? q.recipient,
    sentAt: q.sentAt,
  };
}

export function listQuestions(project: ProjectSnapshot, input: ListQuestionsInput): QuestionLine[] {
  const recipient = recipientFilter(project, input.recipient);
  return project.questions
    .map((q) => questionLine(project, q))
    .filter((q) => inQuestionState(q.state, input.state))
    .filter((q) => input.ticketKey === undefined || q.ticket === input.ticketKey)
    .filter((q) => recipient === null || q.recipient === recipient);
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

const inState = (signal: Signal, state: ListSignalsInput["state"]): boolean =>
  state === "all" || (state === "open") === isOpenSignal(signal);

export function listSignals(signals: readonly Signal[], input: ListSignalsInput): ToolPage<SignalLine> {
  const lines = signals
    .filter((s) => inState(s, input.state))
    .sort((a, b) => a.seq - b.seq)
    .map(signalLine);
  return pageOf(lines, input.cursor);
}

export const compactJson = (value: unknown): string => JSON.stringify(value);
