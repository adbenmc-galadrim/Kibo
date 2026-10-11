import { type AgentsState, isTerminal, type RunView } from "@kibo/schema";

export const RECENT_MS = 24 * 3_600_000;

export type DockGroups = { active: RunView[]; waiting: RunView[]; queued: RunView[]; recent: RunView[] };

export function dockGroups(state: AgentsState, now: number): DockGroups {
  const byId = new Map(state.runs.map((r) => [r.id, r]));
  return {
    active: state.runs
      .filter((r) => r.state === "running" || r.state === "starting")
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)),
    waiting: state.runs.filter((r) => r.state === "waiting_input"),
    queued: state.queue.flatMap((entry) => byId.get(entry.runId) ?? []),
    recent: state.runs
      .filter((r) => isTerminal(r.state) && (r.endedAt ?? 0) >= now - RECENT_MS)
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)),
  };
}
