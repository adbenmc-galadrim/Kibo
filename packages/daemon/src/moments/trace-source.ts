import { foldLines } from "@kibo/core";
import { MOMENT_RAW_MAX, maskSecretsWithin, type PartialReason, type RunView } from "@kibo/schema";
import type { RunTrace } from "./store";
import { freshLive, type TraceCore } from "./trace-live";
import { acceptedTranscriptPath } from "./transcript-path";
import { readLongLine, type TranscriptSlice } from "./transcript-reader";

const UNKNOWN_FORMAT_LINES = 3;
const LONG_LINE_HEAD = 64 * 1024;

const nextTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export function toHooks(core: TraceCore, trace: RunTrace, reason: PartialReason): RunTrace {
  core.flushFold(trace, false);
  const next: RunTrace = { ...trace, source: "hooks", partial: reason };
  core.store.saveTrace(next);
  core.write(trace.runId, [core.moment(trace, { kind: "raw", text: "", partial: reason })]);
  const state = core.live(trace.runId);
  core.write(trace.runId, state.held);
  state.held = [];
  return next;
}

function resumedOffset(core: TraceCore, run: RunView, path: string): number {
  const from = run.session?.mode === "resumed" && run.session.from !== run.id ? run.session.from : null;
  const origin = from === null ? null : core.store.trace(from);
  return origin?.source === "transcript" && origin.path === path ? origin.offset : 0;
}

export function resolve(core: TraceCore, trace: RunTrace, run: RunView, path: string | null): RunTrace {
  if (trace.source === "hooks" || path === null) return trace;
  if (trace.source === "transcript" && path === core.live(trace.runId).from) return trace;
  const accepted = acceptedTranscriptPath(core.deps.root, run.sessionId, path);
  if (accepted === null) return toHooks(core, trace, "path-rejected");
  if (accepted === trace.path) {
    core.live(trace.runId).from = path;
    return trace;
  }
  if (trace.source === "transcript") core.flushFold(trace, false);
  core.lives.set(trace.runId, freshLive(path));
  const next: RunTrace = {
    ...trace,
    source: "transcript",
    path: accepted,
    offset: resumedOffset(core, run, accepted),
    partial: null,
  };
  core.store.saveTrace(next);
  return next;
}

function skipLongLine(core: TraceCore, trace: RunTrace, path: string): boolean {
  const state = core.live(trace.runId);
  const scanFrom = state.scanFrom ?? trace.offset;
  const line = readLongLine(path, {
    offset: trace.offset,
    scanFrom,
    headBytes: LONG_LINE_HEAD,
    maxScan: core.passBytes,
  });
  if (line.kind === "scanning") {
    state.scanFrom = line.scannedTo;
    return line.more;
  }
  state.scanFrom = null;
  core.write(trace.runId, [
    core.moment(trace, { kind: "raw", text: maskSecretsWithin(line.head, MOMENT_RAW_MAX), partial: null }),
  ]);
  core.store.saveTrace({ ...trace, offset: line.offset });
  return true;
}

function foldSlice(core: TraceCore, trace: RunTrace, slice: TranscriptSlice): boolean {
  const state = core.live(trace.runId);
  const folded = foldLines(state.fold, slice.lines, core.ctx(trace));
  state.fold = folded.state;
  core.write(trace.runId, folded.moments);
  const next = { ...trace, offset: slice.offset };
  core.store.saveTrace(next);
  if (folded.state.known) return slice.more;
  state.unknownLines += slice.lines.filter((l) => l.trim() !== "").length;
  if (state.unknownLines < UNKNOWN_FORMAT_LINES) return slice.more;
  toHooks(core, next, "unknown-format");
  return false;
}

export function pass(core: TraceCore, runId: string): boolean {
  const trace = core.traceOf(runId);
  if (trace.source !== "transcript" || trace.path === null || trace.closedAt !== null) return false;
  try {
    if (core.live(runId).scanFrom !== null) return skipLongLine(core, trace, trace.path);
    const slice = core.read(trace.path, trace.offset);
    if (slice.lines.length === 0 && slice.more) return skipLongLine(core, trace, trace.path);
    return foldSlice(core, trace, slice);
  } catch (e) {
    console.error(`[kibo-daemon] transcript of run ${runId} is unreadable`, e);
    toHooks(core, trace, "unreadable");
    return false;
  }
}

export async function drain(core: TraceCore, runId: string): Promise<void> {
  while (pass(core, runId)) await nextTick();
}
