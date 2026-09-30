import type { AgentsState, RunState, RunView } from "@kibo/schema";

export const HISTORY_STATES: readonly RunState[] = ["waiting_input", "done", "failed", "cancelled"];
export const NOTICE_STATES: readonly RunState[] = ["waiting_input", "done", "failed"];
const SEEN_KEY = "kibo.runs.seenAt";

export const runMoment = (run: RunView): number => run.endedAt ?? run.stateSince;

export function runHistory(state: AgentsState, limit = 20): RunView[] {
  return state.runs
    .filter((r) => HISTORY_STATES.includes(r.state))
    .sort((a, b) => runMoment(b) - runMoment(a))
    .slice(0, limit);
}

export function unseenCount(runs: readonly RunView[], seenAt: number): number {
  return runs.filter((r) => NOTICE_STATES.includes(r.state) && runMoment(r) > seenAt).length;
}

function withStorage<T>(work: (storage: Storage) => T, fallback: T): T {
  try {
    return work(window.localStorage);
  } catch (e) {
    console.error("run history storage unavailable", e);
    return fallback;
  }
}

export function readSeenAt(): number {
  const raw = withStorage((s) => s.getItem(SEEN_KEY), null);
  const value = raw === null ? 0 : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function markSeen(now: number): void {
  withStorage((s) => s.setItem(SEEN_KEY, String(now)), undefined);
}
