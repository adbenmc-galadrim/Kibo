import type { RunState, RunView } from "@kibo/schema";

export const RUN_FILTERS = ["all", "done", "failed", "cancelled", "waiting"] as const;
export type RunFilter = (typeof RUN_FILTERS)[number];

const STATE_OF: Record<Exclude<RunFilter, "all">, RunState> = {
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
  waiting: "waiting_input",
};

const matchesFilter = (run: RunView, filter: RunFilter) => filter === "all" || run.state === STATE_OF[filter];

const matchesKey = (run: RunView, prefix: string) =>
  prefix === "" || (run.ticketKey?.toLowerCase().startsWith(prefix) ?? false);

export function filterRuns(runs: readonly RunView[], filter: RunFilter, query: string): RunView[] {
  const prefix = query.trim().toLowerCase();
  return runs.filter((r) => matchesFilter(r, filter) && matchesKey(r, prefix)).sort((a, b) => b.seq - a.seq);
}
