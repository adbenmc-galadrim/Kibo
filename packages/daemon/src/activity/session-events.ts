import type { ProjectEventData, ProjectEventInput, ProjectEventSink, TicketView } from "@kibo/schema";
import type { ClosedSession } from "./session-store";

export type SessionTicket = Pick<TicketView, "id" | "key" | "keyLabel" | "parentId" | "delivery">;
export type SessionEnd = "stop" | "timeout";

function rootIdOf(ticket: SessionTicket, tickets: readonly SessionTicket[]): string {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let current = ticket;
  while (current.parentId !== null && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (parent === undefined) break;
    current = parent;
  }
  return current.id;
}

function sessionEvent(
  kind: "session_started" | "session_stopped",
  ticket: SessionTicket,
  tickets: readonly SessionTicket[],
  data: ProjectEventData,
): ProjectEventInput {
  return {
    kind,
    ticketId: ticket.id,
    featureId: rootIdOf(ticket, tickets),
    source: ticket.delivery?.kind === "update" ? "update-delivery" : "full-delivery",
    data: { ticketKey: ticket.key ?? ticket.keyLabel, ...data },
  };
}

export const startedEvent = (
  ticket: SessionTicket,
  tickets: readonly SessionTicket[],
  tool: string,
): ProjectEventInput => sessionEvent("session_started", ticket, tickets, { tool });

export const stoppedEvent = (
  ticket: SessionTicket,
  tickets: readonly SessionTicket[],
  closed: ClosedSession,
  ended: SessionEnd,
): ProjectEventInput =>
  sessionEvent("session_stopped", ticket, tickets, {
    tool: closed.tool,
    durationMs: closed.durationMs,
    ended,
  });

export function recordStopped(
  sink: ProjectEventSink | undefined,
  tickets: readonly SessionTicket[],
  closed: ClosedSession,
  ended: SessionEnd,
): void {
  const ticket = tickets.find((t) => t.id === closed.ticketId);
  if (sink === undefined || ticket === undefined) return;
  sink.record(closed.projectId, stoppedEvent(ticket, tickets, closed, ended));
}
