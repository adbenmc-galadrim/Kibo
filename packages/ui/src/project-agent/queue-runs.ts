import type { AgentSummary, AgentsState, QueueEntry, RunSubagentSummary, RunView } from "@kibo/schema";

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

export type SubagentSlot = {
  parent: RunView;
  sub: Pick<RunSubagentSummary, "id" | "type" | "description" | "startedAt">;
};

export function subagentsByType(state: AgentsState, runs: readonly RunView[]): Map<string, SubagentSlot[]> {
  const parents = runs.filter(holdsSlot).sort(byStart);
  const slots: SubagentSlot[] =
    state.subagents === undefined
      ? parents.flatMap((parent) =>
          parent.subagents.map((s) => ({ parent, sub: { ...s, description: "", startedAt: s.since } })),
        )
      : parents.flatMap((parent) =>
          (state.subagents ?? []).filter((s) => s.runId === parent.id).map((sub) => ({ parent, sub })),
        );
  const byType = new Map<string, SubagentSlot[]>();
  for (const slot of slots) byType.set(slot.sub.type, [...(byType.get(slot.sub.type) ?? []), slot]);
  return byType;
}
