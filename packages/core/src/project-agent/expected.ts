import {
  type AgentExecution,
  type AgentSummary,
  findRecipient,
  isArchived,
  isDelivered,
  isOpen,
  isTerminal,
  type ProjectSnapshot,
  type ProposedAction,
  type Question,
  type RunView,
  type SignalRef,
  sameSprintCode,
  type TicketView,
  undeliveredAnswers,
} from "@kibo/schema";
import type { NoteHash } from "./fingerprint";

export type BatchContext = {
  project: ProjectSnapshot;
  runs: readonly RunView[];
  notes: readonly NoteHash[];
  agents: readonly AgentSummary[];
  demoProject: boolean;
  viewer: string;
  signals: readonly SignalRef[];
  closedSignals: readonly SignalRef[];
  agentExecution?: AgentExecution;
};

export type TicketLookup = (ref: string) => TicketView | null;

export const ticketByKey =
  (project: ProjectSnapshot): TicketLookup =>
  (ref) =>
    project.tickets.find((t) => t.key === ref) ?? null;

export const ticketRuns = (runs: readonly RunView[], projectId: string): RunView[] =>
  runs.filter((r) => r.projectId === projectId && r.kind === "ticket");

export function activeRunOf(ctx: BatchContext, ticketId: string): string | null {
  const active = ticketRuns(ctx.runs, ctx.project.meta.id).find(
    (r) => r.ticketId === ticketId && !isTerminal(r.state),
  );
  return active?.id ?? null;
}

const undeliveredIds = (ctx: BatchContext, ticketId: string): string[] =>
  undeliveredAnswers(ctx.project.questions, ticketId)
    .map((q) => q.id)
    .sort();

function ticketFields(action: Extract<ProposedAction, { type: "updateTicket" }>, t: TicketView) {
  return {
    ...(action.title !== undefined ? { title: t.title } : {}),
    ...(action.description !== undefined ? { description: t.description } : {}),
    ...(action.labels !== undefined ? { labels: [...t.labels] } : {}),
    ...(action.parent !== undefined ? { parentId: t.parentId } : {}),
  };
}

function onTicket(ref: string, ticketOf: TicketLookup, fields: (t: TicketView) => Record<string, unknown>) {
  const t = ticketOf(ref);
  return t ? fields(t) : {};
}

type QuestionUpdate = Extract<ProposedAction, { type: "updateQuestion" }>;

function questionFields(action: QuestionUpdate, q: Question): Record<string, unknown> {
  return {
    ...(action.title !== undefined ? { title: q.title } : {}),
    ...(action.context !== undefined ? { context: q.context } : {}),
    ...(action.options !== undefined ? { options: [...q.options] } : {}),
    ...(action.provisional !== undefined ? { provisional: q.provisional } : {}),
    ...(action.ticket !== undefined ? { ticketId: q.ticketId } : {}),
    ...(action.recipient !== undefined ? { recipient: q.recipient } : {}),
    delivered: isDelivered(q),
  };
}

function onQuestion(ctx: BatchContext, id: string, fields: (q: Question) => Record<string, unknown>) {
  const q = ctx.project.questions.find((x) => x.id === id);
  return q ? fields(q) : {};
}

const answerAt = (q: Question): number | null => q.answer?.at ?? null;

export function capture(
  action: ProposedAction,
  ctx: BatchContext,
  ticketOf: TicketLookup,
): Record<string, unknown> {
  switch (action.type) {
    case "updateTicket":
      return onTicket(action.ticket, ticketOf, (t) => ticketFields(action, t));
    case "setStatus":
      return onTicket(action.ticket, ticketOf, (t) => ({ statusId: t.statusId }));
    case "assignAgent":
      return onTicket(action.ticket, ticketOf, (t) => ({ activeRun: activeRunOf(ctx, t.id) }));
    case "deliverAnswers":
      return onTicket(action.ticket, ticketOf, (t) => ({ undelivered: undeliveredIds(ctx, t.id) }));
    case "cancelRun": {
      const target = ticketRuns(ctx.runs, ctx.project.meta.id).find((r) => r.id === action.runId);
      return { terminal: target ? isTerminal(target.state) : true };
    }
    case "answerQuestion": {
      const q = ctx.project.questions.find((x) => x.id === action.questionId);
      return { answered: q ? !isOpen(q) : true };
    }
    case "updateQuestion":
      return onQuestion(ctx, action.questionId, (q) => questionFields(action, q));
    case "reopenQuestion":
      return onQuestion(ctx, action.questionId, (q) => ({ answerAt: answerAt(q) }));
    case "deleteQuestion":
      return onQuestion(ctx, action.questionId, (q) => ({ archived: isArchived(q), answerAt: answerAt(q) }));
    case "addRecipient":
      return { exists: findRecipient(ctx.project.questionRecipients, action.name.trim()) !== null };
    case "createNote":
      return { exists: ctx.notes.some((n) => n.path === action.path) };
    case "updateNote":
      return { hash: ctx.notes.find((n) => n.path === action.path)?.hash ?? null };
    case "setSprint":
      return onTicket(action.ticket, ticketOf, (t) => ({ sprintId: t.sprintId }));
    case "setHold":
      return onTicket(action.ticket, ticketOf, (t) => ({ hold: t.hold }));
    case "createSprint":
      return { exists: ctx.project.sprints.some((s) => sameSprintCode(s.code, action.code)) };
    case "remindQuestion":
      return onQuestion(ctx, action.questionId, (q) => ({ answered: !isOpen(q) }));
    case "createTicket":
    case "link":
    case "unlink":
    case "createQuestion":
    case "dismissSignal":
      return {};
  }
}

export const captureExpected = (action: ProposedAction, ctx: BatchContext): Record<string, unknown> =>
  capture(action, ctx, ticketByKey(ctx.project));
