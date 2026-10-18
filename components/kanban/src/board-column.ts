import type { StatusId, Ticket } from "@kibo/schema";

export function boardColumn(
  ticket: Pick<Ticket, "statusId">,
  blocked: boolean,
  columns: ReadonlySet<StatusId>,
): StatusId {
  if (!blocked || ticket.statusId === "done" || !columns.has("blocked")) return ticket.statusId;
  return "blocked";
}
