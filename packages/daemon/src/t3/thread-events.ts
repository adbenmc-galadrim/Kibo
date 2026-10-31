import type { ProjectEventInput } from "@kibo/schema";
import { rootIdOf, type SessionTicket } from "../activity/session-events";

export function threadEvent(
  input: {
    kind: "t3_started" | "t3_finished";
    source: ProjectEventInput["source"];
    ticketId: string;
    threadId: string;
    status: string;
  },
  tickets: readonly SessionTicket[],
): ProjectEventInput {
  const ticket = tickets.find((t) => t.id === input.ticketId);
  return {
    kind: input.kind,
    ticketId: input.ticketId,
    featureId: ticket ? rootIdOf(ticket, tickets) : null,
    source: input.source,
    data: {
      threadId: input.threadId,
      status: input.status,
      ticketKey: ticket ? (ticket.key ?? ticket.keyLabel) : null,
    },
  };
}
