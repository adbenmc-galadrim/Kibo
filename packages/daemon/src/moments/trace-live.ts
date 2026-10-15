import { emptyFold, type FoldedMoment, type FoldState, flushActions } from "@kibo/core";
import {
  type MomentData,
  type RunAction,
  type RunMoment,
  type RunMomentsEvent,
  TRANSCRIPT_PASS_MAX_BYTES,
} from "@kibo/schema";
import { HookGroup } from "./hook-group";
import type { MomentStore, RunTrace } from "./store";
import { readTranscriptSlice, type TranscriptSlice } from "./transcript-reader";

export type SubagentSource = { subagentId: string; path: string; offset: number; ended: boolean };
export type SubagentPort = {
  discover(runId: string, transcriptPath: string): void;
  sources(runId: string): SubagentSource[];
  read(path: string, offset: number, maxBytes: number): TranscriptSlice;
  skip(path: string, offset: number): number | null;
  advanced(runId: string, source: SubagentSource, offset: number, closed: boolean): void;
  onLines(runId: string, subagentId: string | null, lines: readonly string[]): void;
};

export type TraceDeps = {
  store: MomentStore;
  root: string;
  now: () => number;
  emit(event: RunMomentsEvent): void;
  onActions?(runId: string, actions: readonly RunAction[], at: number): void;
  read?: (path: string, offset: number) => TranscriptSlice;
  passBytes?: number;
  subagents?: SubagentPort;
};

export type Live = {
  fold: FoldState;
  unknownLines: number;
  group: HookGroup;
  from: string | null;
  scanFrom: number | null;
  held: FoldedMoment[];
  subFolds: Map<string, FoldState>;
};

export type TraceCore = {
  deps: TraceDeps;
  store: MomentStore;
  read(path: string, offset: number): TranscriptSlice;
  passBytes: number;
  lives: Map<string, Live>;
  traceOf(runId: string): RunTrace;
  live(runId: string): Live;
  ctx(trace: RunTrace): { stepId: string | null; now: number };
  moment(trace: RunTrace, data: MomentData): FoldedMoment;
  write(runId: string, items: readonly FoldedMoment[]): RunMoment[];
  flushFold(trace: RunTrace, keepPending: boolean): void;
  enqueue(runId: string, job: () => Promise<void>): Promise<void>;
};

export const newTrace = (runId: string): RunTrace => ({
  runId,
  path: null,
  offset: 0,
  source: "pending",
  partial: null,
  doingStep: null,
  baseHead: null,
  closedAt: null,
});

export const freshLive = (from: string | null = null): Live => ({
  fold: emptyFold(),
  unknownLines: 0,
  group: new HookGroup(),
  from,
  scanFrom: null,
  held: [],
  subFolds: new Map(),
});

export function createTraceCore(deps: TraceDeps): TraceCore {
  const { store } = deps;
  const passBytes = deps.passBytes ?? TRANSCRIPT_PASS_MAX_BYTES;
  const read = deps.read ?? ((path: string, offset: number) => readTranscriptSlice(path, offset, passBytes));
  const lives = new Map<string, Live>();
  const chains = new Map<string, Promise<void>>();

  const live = (runId: string): Live => {
    const found = lives.get(runId);
    if (found) return found;
    const created = freshLive();
    lives.set(runId, created);
    return created;
  };
  const ctx = (trace: RunTrace) => ({ stepId: trace.doingStep, now: deps.now() });

  function notifyActions(runId: string, moments: readonly RunMoment[]): void {
    for (const m of moments) {
      if (m.data.kind !== "actions") continue;
      try {
        deps.onActions?.(runId, m.data.actions, m.at);
      } catch (e) {
        console.error(`[kibo-daemon] actions of run ${runId} were not counted`, e);
      }
    }
  }

  function write(runId: string, items: readonly FoldedMoment[]): RunMoment[] {
    const moments = items.map((m) => store.append(runId, m.data, m.stepId, m.at, m.subagentId ?? null));
    if (moments.length > 0) deps.emit({ type: "run.moments", runId, moments });
    notifyActions(runId, moments);
    return moments;
  }

  function flushFold(trace: RunTrace, keepPending: boolean): void {
    const state = live(trace.runId);
    const pending = state.fold.pending;
    const flushed = flushActions(
      keepPending ? { ...state.fold, pending: new Map() } : state.fold,
      ctx(trace),
    );
    state.fold = keepPending ? { ...flushed.state, pending } : flushed.state;
    write(trace.runId, flushed.moments);
  }

  function enqueue(runId: string, job: () => Promise<void>): Promise<void> {
    const next = (chains.get(runId) ?? Promise.resolve()).then(job);
    const settled = next.catch(() => undefined);
    chains.set(runId, settled);
    void settled.then(() => {
      if (chains.get(runId) === settled) chains.delete(runId);
    });
    return next;
  }

  return {
    deps,
    store,
    read,
    passBytes,
    lives,
    traceOf: (runId) => store.trace(runId) ?? newTrace(runId),
    live,
    ctx,
    moment: (trace, data) => ({ data, at: deps.now(), stepId: trace.doingStep }),
    write,
    flushFold,
    enqueue,
  };
}
