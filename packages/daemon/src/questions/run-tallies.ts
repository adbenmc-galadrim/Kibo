import { mainSessionOf, type RunQuestions, type RunView } from "@kibo/schema";

const ticketsOf = (runs: readonly RunView[]): Map<string, string> =>
  new Map(runs.flatMap((r) => (r.projectId && r.ticketId ? [[r.ticketId, r.projectId] as const] : [])));

export function runTallies(
  asked: readonly RunQuestions[],
  runs: readonly RunView[],
  undeliveredOf: (projectId: string, ticketId: string) => number,
): RunQuestions[] {
  const byRun = new Map(asked.filter((q) => q.open > 0).map((q) => [q.runId, { ...q, undelivered: 0 }]));
  for (const [ticketId, projectId] of ticketsOf(runs)) {
    const undelivered = undeliveredOf(projectId, ticketId);
    const main = undelivered > 0 ? mainSessionOf(runs, ticketId) : null;
    if (!main) continue;
    const known = byRun.get(main.id) ?? { runId: main.id, open: 0, undelivered: 0, latestTitle: null };
    byRun.set(main.id, { ...known, undelivered });
  }
  return [...byRun.values()].sort((a, b) => a.runId.localeCompare(b.runId));
}
