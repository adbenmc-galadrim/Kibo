import type { AgentSummary, QueueEntry, RunView } from "@kibo/schema";

export const holdsSlot = (r: RunView) => r.state === "running" || r.state === "starting";
export const byStart = (a: RunView, b: RunView) => (a.startedAt ?? 0) - (b.startedAt ?? 0);

export function orderAgents(agents: AgentSummary[], runs: RunView[], queue: QueueEntry[]): AgentSummary[] {
  const queuedIds = new Set(queue.map((q) => q.runId));
  const busy = new Set(runs.filter((r) => holdsSlot(r) || queuedIds.has(r.id)).map((r) => r.profileId));
  const rank = (p: AgentSummary) => (busy.has(p.ref) ? 0 : 1);
  return [...agents].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function queueNeighbours(
  visibleQueue: readonly QueueEntry[],
  runId: string,
): { prev: QueueEntry | null; next: QueueEntry | null } {
  const sorted = [...visibleQueue].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((q) => q.runId === runId);
  if (i < 0) return { prev: null, next: null };
  return { prev: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null };
}
