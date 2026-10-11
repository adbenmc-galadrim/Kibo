import { isTerminal, KiboError, type ProjectActivity, type RunPeek, type TicketRun } from "@kibo/schema";

export const activityOf = (runs: readonly TicketRun[]): ProjectActivity => ({
  busyTickets: new Set(runs.filter((r) => !isTerminal(r.state)).map((r) => r.ticketId)),
});

export type MockRuns = { peek(runId: string): RunPeek; open(runId: string): void; opened: string[] };

export function createMockRuns(peeks: Record<string, RunPeek>): MockRuns {
  const opened: string[] = [];
  return {
    peek(runId) {
      const peek = peeks[runId];
      if (!peek) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
      return structuredClone(peek);
    },
    open: (runId) => {
      opened.push(runId);
    },
    opened,
  };
}
