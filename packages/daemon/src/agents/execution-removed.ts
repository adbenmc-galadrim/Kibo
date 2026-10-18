import { KiboError, type RunRecord } from "@kibo/schema";

export const isTicketRun = (run: Pick<RunRecord, "kind" | "ticketId">): boolean =>
  run.kind === "ticket" && run.ticketId !== null;

export function refuseTicketExecution(what: string): never {
  throw new KiboError("AGENT_EXECUTION_REMOVED", `${what}: Kibo no longer runs ticket agents`);
}
