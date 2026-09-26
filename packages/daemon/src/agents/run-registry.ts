import { initRun, reduceRun } from "@kibo/core/run-machine";
import { KiboError, type RunEvent, type RunLogEntry, type RunState, type RunView } from "@kibo/schema";
import type { NewRun, RunStore } from "./run-store";

export type RunChange = (run: RunView, previous: RunState | null) => void;
export type RunRegistry = {
  create(run: NewRun, rank: number): RunView;
  apply(runId: string, event: RunEvent): RunView;
  get(runId: string): RunView;
  all(): RunView[];
  log(runId: string): RunLogEntry[];
  tokensSince(at: number): number;
  interrupted(): RunView[];
  onChange(listener: RunChange): () => void;
};

const INTERRUPTED: RunEvent = { type: "failed", error: "INTERRUPTED: the daemon restarted during the run" };

function replay(store: RunStore): {
  views: Map<string, RunView>;
  exits: Array<{ at: number; tokens: number }>;
} {
  const views = new Map<string, RunView>();
  const exits: Array<{ at: number; tokens: number }> = [];
  const records = new Map(store.records().map((r) => [r.id, r]));
  for (const { runId, at, event } of store.events()) {
    const current = views.get(runId);
    if (!current) {
      const record = records.get(runId);
      if (!record || event.type !== "enqueued") {
        throw new KiboError("STORE_CORRUPT", `run ${runId} does not start with enqueued`);
      }
      views.set(runId, initRun(record, event.rank, at));
      continue;
    }
    try {
      views.set(runId, reduceRun(current, event, at));
    } catch (e) {
      throw new KiboError("STORE_CORRUPT", `run ${runId}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (event.type === "exited") exits.push({ at, tokens: event.tokens });
  }
  return { views, exits };
}

export function openRunRegistry(store: RunStore, now: () => number = Date.now): RunRegistry {
  const { views, exits } = replay(store);
  const listeners = new Set<RunChange>();
  const restartedAt = now();
  const interrupted: RunView[] = [];
  for (const view of [...views.values()]) {
    if (view.state === "starting" || view.state === "running") {
      store.append(view.id, INTERRUPTED, restartedAt);
      const failed = reduceRun(view, INTERRUPTED, restartedAt);
      views.set(view.id, failed);
      interrupted.push(failed);
    }
  }
  const emit = (run: RunView, previous: RunState | null) => {
    for (const listener of listeners) listener(run, previous);
  };
  const get = (runId: string): RunView => {
    const view = views.get(runId);
    if (!view) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
    return view;
  };
  return {
    create(run, rank) {
      const at = now();
      const view = initRun(store.create(run, rank, at), rank, at);
      views.set(view.id, view);
      emit(view, null);
      return view;
    },
    apply(runId, event) {
      const current = get(runId);
      const at = now();
      const next = reduceRun(current, event, at);
      store.append(runId, event, at);
      views.set(runId, next);
      if (event.type === "exited") exits.push({ at, tokens: event.tokens });
      emit(next, current.state);
      return next;
    },
    get,
    all: () => [...views.values()].sort((a, b) => a.seq - b.seq),
    log(runId) {
      get(runId);
      return store.log(runId);
    },
    tokensSince: (since) => exits.filter((e) => e.at >= since).reduce((sum, e) => sum + e.tokens, 0),
    interrupted: () => [...interrupted],
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
