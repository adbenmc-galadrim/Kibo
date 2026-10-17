import {
  isTerminal,
  NO_ACTIVITY,
  type ProjectActivity,
  type RunView,
  type TicketSession,
} from "@kibo/schema";

type BusyTicket = { projectId: string; ticketId: string };

export type ActivitySources = {
  sessions?(projectId: string): ReadonlyMap<string, TicketSession>;
  lastEventAt?(projectId: string): ReadonlyMap<string, number>;
};

export type ActivityTracker = {
  track(run: RunView): void;
  activity(projectId: string): ProjectActivity;
};

const busyTicketOf = (run: RunView): BusyTicket | null =>
  run.projectId !== null && run.ticketId !== null && !isTerminal(run.state)
    ? { projectId: run.projectId, ticketId: run.ticketId }
    : null;

export function createActivityTracker(
  runs: readonly RunView[],
  sources: ActivitySources = {},
): ActivityTracker {
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
      const running = [...busy.values()].filter((b) => b.projectId === projectId).map((b) => b.ticketId);
      const sessions = sources.sessions?.(projectId) ?? NO_ACTIVITY.sessions;
      const lastEventAt = sources.lastEventAt?.(projectId) ?? NO_ACTIVITY.lastEventAt;
      const busyTickets = new Set([...running, ...sessions.keys()]);
      if (busyTickets.size === 0 && lastEventAt.size === 0) return NO_ACTIVITY;
      return { busyTickets, sessions, lastEventAt };
    },
  };
}
