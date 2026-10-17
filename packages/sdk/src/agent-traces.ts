import type { AgentExecution, TicketView } from "@kibo/schema";

export const withoutAgentAssignee = <T extends Pick<TicketView, "assignee">>(ticket: T): T =>
  ticket.assignee?.kind === "agent" ? { ...ticket, assignee: null } : ticket;

export const agentTracesShown = (execution: AgentExecution): boolean => execution === "shown";
