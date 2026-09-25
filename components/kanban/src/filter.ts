import type { TicketView } from "@kibo/schema";

export type KanbanFilter = "mine-and-agents" | "all";

export function filterTickets(tickets: TicketView[], filter: KanbanFilter, viewer: string): TicketView[] {
  if (filter === "all") return tickets;
  return tickets.filter(
    (t) => t.assignee?.kind === "agent" || (t.assignee?.kind === "human" && t.assignee.ref === viewer),
  );
}
