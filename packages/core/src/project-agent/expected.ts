import {
  type AgentProfile,
  isTerminal,
  type ProjectSnapshot,
  type ProposedAction,
  type RunView,
  type TicketView,
  undeliveredAnswers,
} from "@kibo/schema";
import type { NoteHash } from "./fingerprint";

export type BatchContext = {
  project: ProjectSnapshot;
  runs: readonly RunView[];
  notes: readonly NoteHash[];
  profiles: readonly AgentProfile[];
  demoProject: boolean;
  viewer: string;
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
      return { answered: q ? q.answer !== null : true };
    }
    case "createNote":
      return { exists: ctx.notes.some((n) => n.path === action.path) };
    case "updateNote":
      return { hash: ctx.notes.find((n) => n.path === action.path)?.hash ?? null };
    case "createTicket":
    case "link":
    case "unlink":
    case "createQuestion":
      return {};
  }
}

export const captureExpected = (action: ProposedAction, ctx: BatchContext): Record<string, unknown> =>
  capture(action, ctx, ticketByKey(ctx.project));
