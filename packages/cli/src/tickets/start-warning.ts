import type { StartReason, TicketView } from "@kibo/schema";
import { frTickets } from "../fr";

const r = frTickets.reasons;

function reasonText(reason: Exclude<StartReason, { kind: "status" }>): string {
  if (reason.kind === "dependency") return r.waiting(reason.keys);
  if (reason.kind === "question") return r.question(reason.label);
  if (reason.kind === "sprint") return r.sprint(reason.code);
  if (reason.kind === "unplanned") return r.unplanned;
  return r.limit;
}

type StartView = Pick<TicketView, "startable" | "startReason" | "waitingOn">;

export function notStartableReasons(ticket: StartView): string[] | null {
  const reason = ticket.startReason;
  if (ticket.startable || reason === null || reason.kind === "status") return null;
  const waiting = reason.kind !== "dependency" && ticket.waitingOn.length > 0;
  return [reasonText(reason), ...(waiting ? [r.waiting(ticket.waitingOn)] : [])];
}
