import { emptyFold, type FoldedMoment, type FoldState, flushActions, foldLines } from "@kibo/core";
import {
  type HookPayload,
  isTerminal,
  KiboError,
  MOMENT_RAW_MAX,
  type MomentData,
  maskSecretsWithin,
  type PartialReason,
  type RunMoment,
  type RunMomentsEvent,
  type RunMomentsPage,
  type RunPeek,
  type RunProgressSummary,
  type RunView,
  type TodoItem,
  TRANSCRIPT_PASS_MAX_BYTES,
  todosToPlan,
} from "@kibo/schema";
import { HookGroup, hookMoments } from "./hook-group";
import type { MomentStore, RunTrace } from "./store";
import { pageOf, peekOf } from "./trace-read";
import { acceptedTranscriptPath } from "./transcript-path";
import { readLongLine, readTranscriptSlice, type TranscriptSlice } from "./transcript-reader";

export type TraceDeps = {
  store: MomentStore;
  root: string;
  now: () => number;
  emit(event: RunMomentsEvent): void;
  read?: (path: string, offset: number) => TranscriptSlice;
  passBytes?: number;
};
export type TraceService = {
  onHook(run: RunView, payload: HookPayload): Promise<void>;
  onTurnEnd(run: RunView): Promise<void>;
  reminder(runId: string, kind: "plan" | "report"): RunMoment;
  setDoingStep(runId: string, stepId: string | null): void;
  setBaseHead(runId: string, head: string | null): void;
  trace(runId: string): RunTrace | null;
  page(runId: string, after?: number): RunMomentsPage;
  peek(run: RunView, progress: RunProgressSummary | null): RunPeek;
};

const PASS_EVENTS: ReadonlySet<string> = new Set(["PostToolUse", "Stop", "SubagentStop", "Notification"]);
const UNKNOWN_FORMAT_LINES = 3;
const LONG_LINE_HEAD = 64 * 1024;
const STEP_TITLE_MAX = 160;

type Live = {
  fold: FoldState;
  unknownLines: number;
  group: HookGroup;
  from: string | null;
  scanFrom: number | null;
  held: FoldedMoment[];
};

const nextTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const newTrace = (runId: string): RunTrace => ({
  runId,
  path: null,
  offset: 0,
  source: "pending",
  partial: null,
  doingStep: null,
  baseHead: null,
  closedAt: null,
});

const maskedPlan = (todos: readonly TodoItem[]) =>
  todosToPlan(todos).map((step) => ({ ...step, title: maskSecretsWithin(step.title, STEP_TITLE_MAX) }));

export function createTraceService(deps: TraceDeps): TraceService {
  const { store } = deps;
  const passBytes = deps.passBytes ?? TRANSCRIPT_PASS_MAX_BYTES;
  const read = deps.read ?? ((path: string, offset: number) => readTranscriptSlice(path, offset, passBytes));
  const lives = new Map<string, Live>();
  const chains = new Map<string, Promise<void>>();

  const traceOf = (runId: string): RunTrace => store.trace(runId) ?? newTrace(runId);
  const live = (runId: string): Live => {
    const found = lives.get(runId);
    if (found) return found;
    const created: Live = {
      fold: emptyFold(),
      unknownLines: 0,
      group: new HookGroup(),
      from: null,
      scanFrom: null,
      held: [],
    };
    lives.set(runId, created);
    return created;
  };
  const ctx = (trace: RunTrace) => ({ stepId: trace.doingStep, now: deps.now() });
  const moment = (trace: RunTrace, data: MomentData): FoldedMoment => ({
    data,
    at: deps.now(),
    stepId: trace.doingStep,
  });

  function write(runId: string, items: readonly FoldedMoment[]): RunMoment[] {
    const moments = items.map((m) => store.append(runId, m.data, m.stepId, m.at));
    if (moments.length > 0) deps.emit({ type: "run.moments", runId, moments });
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

  function toHooks(trace: RunTrace, reason: PartialReason): RunTrace {
    flushFold(trace, false);
    const next: RunTrace = { ...trace, source: "hooks", partial: reason };
    store.saveTrace(next);
    write(trace.runId, [moment(trace, { kind: "raw", text: "", partial: reason })]);
    const state = live(trace.runId);
    write(trace.runId, state.held);
    state.held = [];
    return next;
  }

  function resolve(trace: RunTrace, run: RunView, path: string | null): RunTrace {
    if (trace.source === "hooks" || path === null) return trace;
    if (trace.source === "transcript" && path === live(trace.runId).from) return trace;
    const accepted = acceptedTranscriptPath(deps.root, run.sessionId, path);
    if (accepted === null) return toHooks(trace, "path-rejected");
    if (accepted === trace.path) {
      live(trace.runId).from = path;
      return trace;
    }
    if (trace.source === "transcript") flushFold(trace, false);
    lives.set(trace.runId, {
      ...live(trace.runId),
      fold: emptyFold(),
      unknownLines: 0,
      from: path,
      scanFrom: null,
      group: new HookGroup(),
      held: [],
    });
    const next: RunTrace = { ...trace, source: "transcript", path: accepted, offset: 0, partial: null };
    store.saveTrace(next);
    return next;
  }

  function skipLongLine(trace: RunTrace, path: string): boolean {
    const state = live(trace.runId);
    const scanFrom = state.scanFrom ?? trace.offset;
    const line = readLongLine(path, {
      offset: trace.offset,
      scanFrom,
      headBytes: LONG_LINE_HEAD,
      maxScan: passBytes,
    });
    if (line.kind === "scanning") {
      state.scanFrom = line.scannedTo;
      return line.more;
    }
    state.scanFrom = null;
    write(trace.runId, [
      moment(trace, { kind: "raw", text: maskSecretsWithin(line.head, MOMENT_RAW_MAX), partial: null }),
    ]);
    store.saveTrace({ ...trace, offset: line.offset });
    return true;
  }

  function foldSlice(trace: RunTrace, slice: TranscriptSlice): boolean {
    const state = live(trace.runId);
    const folded = foldLines(state.fold, slice.lines, ctx(trace));
    state.fold = folded.state;
    write(trace.runId, folded.moments);
    const next = { ...trace, offset: slice.offset };
    store.saveTrace(next);
    if (folded.state.known) return slice.more;
    state.unknownLines += slice.lines.filter((l) => l.trim() !== "").length;
    if (state.unknownLines < UNKNOWN_FORMAT_LINES) return slice.more;
    toHooks(next, "unknown-format");
    return false;
  }

  function pass(runId: string): boolean {
    const trace = traceOf(runId);
    if (trace.source !== "transcript" || trace.path === null || trace.closedAt !== null) return false;
    try {
      if (live(runId).scanFrom !== null) return skipLongLine(trace, trace.path);
      const slice = read(trace.path, trace.offset);
      if (slice.lines.length === 0 && slice.more) return skipLongLine(trace, trace.path);
      return foldSlice(trace, slice);
    } catch (e) {
      console.error(`[kibo-daemon] transcript of run ${runId} is unreadable`, e);
      toHooks(trace, "unreadable");
      return false;
    }
  }

  async function drain(runId: string): Promise<void> {
    while (pass(runId)) await nextTick();
  }

  function hookStep(runId: string, payload: HookPayload): void {
    const trace = traceOf(runId);
    if (trace.source === "transcript") return;
    const state = live(runId);
    const moments = hookMoments(state.group, payload, ctx(trace));
    if (trace.source === "hooks") write(runId, moments);
    else state.held.push(...moments);
  }

  function settle(runId: string): RunTrace {
    const trace = traceOf(runId);
    if (trace.closedAt !== null) return trace;
    if (trace.source === "transcript") {
      pass(runId);
      flushFold(traceOf(runId), true);
    }
    if (traceOf(runId).source === "hooks") write(runId, live(runId).group.flush(ctx(trace)));
    return traceOf(runId);
  }

  function writeHeld(trace: RunTrace): void {
    const state = live(trace.runId);
    state.held.push(...state.group.flush(ctx(trace)));
    if (state.held.length > 0) toHooks(trace, "path-rejected");
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

  async function turnEnd(run: RunView): Promise<void> {
    const trace = traceOf(run.id);
    if (trace.closedAt !== null) return;
    if (run.transcriptPath !== null) resolve(trace, run, run.transcriptPath);
    await drain(run.id);
    const current = traceOf(run.id);
    if (current.source === "transcript") flushFold(current, false);
    if (current.source === "hooks") write(run.id, live(run.id).group.flush(ctx(current)));
    if (!isTerminal(run.state)) return;
    if (current.source === "pending") writeHeld(current);
    store.saveTrace({ ...traceOf(run.id), closedAt: deps.now() });
    lives.delete(run.id);
  }

  return {
    async onHook(run, payload) {
      if (traceOf(run.id).closedAt !== null) return;
      if (payload.todos !== null) store.saveInternalPlan(run.id, maskedPlan(payload.todos), deps.now());
      if (!PASS_EVENTS.has(payload.event)) return;
      await enqueue(run.id, async () => {
        const trace = traceOf(run.id);
        if (trace.closedAt !== null) return;
        resolve(trace, run, payload.transcriptPath ?? run.transcriptPath);
        await drain(run.id);
        hookStep(run.id, payload);
      });
    },
    onTurnEnd: (run) => enqueue(run.id, () => turnEnd(run)),
    reminder(runId, kind) {
      const trace = settle(runId);
      const [written] = write(runId, [moment(trace, { kind: "reminder", reminder: kind })]);
      if (!written) throw new KiboError("INTERNAL", `reminder of run ${runId} was not written`);
      return written;
    },
    setDoingStep(runId, stepId) {
      if (traceOf(runId).doingStep === stepId) return;
      store.saveTrace({ ...settle(runId), doingStep: stepId });
    },
    setBaseHead(runId, head) {
      store.saveTrace({ ...traceOf(runId), baseHead: head });
    },
    trace: (runId) => store.trace(runId),
    page: (runId, after) => pageOf(store, runId, after),
    peek: (run, progress) => peekOf(store, run, progress),
  };
}
