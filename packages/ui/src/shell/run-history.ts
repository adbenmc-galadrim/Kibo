import type { AgentsState, RunState, RunView } from "@kibo/schema";
import { readPref, writePref } from "../lib/local-pref";

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

export function readSeenAt(): number {
  const value = Number(readPref(SEEN_KEY, "0"));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function markSeen(now: number): void {
  writePref(SEEN_KEY, String(now));
}
