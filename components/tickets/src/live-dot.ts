import type { AgentExecution, TicketRun, TicketView } from "@kibo/schema";
import { liveRun } from "@kibo/sdk";

export type LiveDot = { kind: "session"; tool: string } | { kind: "run" };

export function liveDot(
  ticket: Pick<TicketView, "session">,
  run: TicketRun | null,
  execution: AgentExecution,
): LiveDot | null {
  if (ticket.session) return { kind: "session", tool: ticket.session.tool };
  return execution === "shown" && liveRun(run) !== null ? { kind: "run" } : null;
}
