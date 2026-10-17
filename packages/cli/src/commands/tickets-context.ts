import { KiboError, type ProjectSnapshot } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { frTickets } from "../fr";
import { summarize, type TicketSummary } from "../tickets/ticket-view";
import type { SessionIo } from "./daemon-session";

export type TicketsContext = {
  client: DaemonClient;
  snapshot: ProjectSnapshot;
  flags: Parsed["flags"];
  io: SessionIo;
};

export function summaryOf(snapshot: ProjectSnapshot, id: string): TicketSummary {
  const found = summarize(snapshot).find((t) => t.id === id);
  if (!found) throw new KiboError("NOT_FOUND", `ticket ${id} vanished`);
  return found;
}

export function notFound(ident: string, io: SessionIo): number {
  io.err(frTickets.ticketNotFound(ident));
  return 1;
}
