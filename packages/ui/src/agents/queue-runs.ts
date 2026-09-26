import type { AgentProfile, QueueEntry, RunView } from "@kibo/schema";

export const holdsSlot = (r: RunView) => r.state === "running" || r.state === "starting";
export const byStart = (a: RunView, b: RunView) => (a.startedAt ?? 0) - (b.startedAt ?? 0);

export function orderProfiles(
  profiles: AgentProfile[],
  runs: RunView[],
  queue: QueueEntry[],
): AgentProfile[] {
  const queuedIds = new Set(queue.map((q) => q.runId));
  const busy = new Set(runs.filter((r) => holdsSlot(r) || queuedIds.has(r.id)).map((r) => r.profileId));
  const rank = (p: AgentProfile) => (busy.has(p.id) ? 0 : 1);
  return [...profiles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
