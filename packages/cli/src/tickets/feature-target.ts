import { KiboError, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { lookupTicket } from "./ticket-view";

function rootOf(ticket: TicketView, tickets: readonly TicketView[]): TicketView {
  const seen = new Set([ticket.id]);
  let current = ticket;
  for (;;) {
    const parent = tickets.find((t) => t.id === current.parentId);
    if (parent === undefined || seen.has(parent.id)) return current;
    seen.add(parent.id);
    current = parent;
  }
}

export function featureOf(snapshot: ProjectSnapshot, raw: string): TicketView {
  const ticket = lookupTicket(snapshot.tickets, raw);
  if (ticket === null) throw new KiboError("NOT_FOUND", `ticket ${raw} not found`);
  if (ticket.parentId === null) return ticket;
  const root = rootOf(ticket, snapshot.tickets);
  throw new KiboError(
    "INVALID_INPUT",
    `${ticket.keyLabel} is a step of ${root.shortKey ?? root.keyLabel}: give the feature`,
  );
}
