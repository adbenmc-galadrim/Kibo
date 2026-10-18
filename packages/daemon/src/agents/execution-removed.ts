import { KiboError, type RunRecord } from "@kibo/schema";

export type TicketExecution = "removed" | "allowed";

export const isTicketRun = (run: Pick<RunRecord, "kind" | "ticketId">): boolean =>
  run.kind === "ticket" && run.ticketId !== null;

export const allowsTicketExecution = (mode: TicketExecution | undefined): boolean => mode === "allowed";

export function refuseTicketExecution(what: string): never {
  throw new KiboError("AGENT_EXECUTION_REMOVED", `${what}: Kibo no longer runs ticket agents`);
}

export function assertTicketExecution(mode: TicketExecution, what: string): void {
  if (mode !== "allowed") refuseTicketExecution(what);
}
