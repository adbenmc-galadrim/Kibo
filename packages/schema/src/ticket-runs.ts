import type { AgentsState, RunView, TicketRun } from "./run";

export function ticketRuns(state: AgentsState, projectId: string): TicketRun[] {
  const positions = new Map(state.queue.map((q) => [q.runId, q.position]));
  const latest = new Map<string, RunView>();
  for (const run of state.runs) {
    if (run.projectId !== projectId || run.ticketId === null) continue;
    const known = latest.get(run.ticketId);
    if (!known || run.seq > known.seq) latest.set(run.ticketId, run);
  }
  return [...latest].map(([ticketId, run]) => ({
    ticketId,
    runId: run.id,
    label: run.label,
    state: run.state,
    position: positions.get(run.id) ?? null,
  }));
}

export function mainSessionOf(runs: readonly RunView[], ticketId: string): RunView | null {
  let main: RunView | null = null;
  for (const run of runs) {
    if (run.ticketId !== ticketId || run.startedAt === null) continue;
    if (main === null || run.seq > main.seq) main = run;
  }
  return main;
}
