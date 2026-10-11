import { isTerminal, NO_ACTIVITY, type ProjectActivity, type RunView } from "@kibo/schema";

type BusyTicket = { projectId: string; ticketId: string };

export type ActivityTracker = {
  track(run: RunView): void;
  activity(projectId: string): ProjectActivity;
};

const busyTicketOf = (run: RunView): BusyTicket | null =>
  run.projectId !== null && run.ticketId !== null && !isTerminal(run.state)
    ? { projectId: run.projectId, ticketId: run.ticketId }
    : null;

export function createActivityTracker(runs: readonly RunView[]): ActivityTracker {
  const busy = new Map<string, BusyTicket>();
  const track = (run: RunView) => {
    const ticket = busyTicketOf(run);
    if (ticket) busy.set(run.id, ticket);
    else busy.delete(run.id);
  };
  for (const run of runs) track(run);
  return {
    track,
    activity(projectId) {
      const tickets = [...busy.values()].filter((b) => b.projectId === projectId).map((b) => b.ticketId);
      return tickets.length === 0 ? NO_ACTIVITY : { busyTickets: new Set(tickets) };
    },
  };
}
