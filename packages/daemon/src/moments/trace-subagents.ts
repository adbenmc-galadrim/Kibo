import { emptyFold, flushActions, foldLines } from "@kibo/core";
import type { RunTrace } from "./store";
import type { SubagentPort, SubagentSource, TraceCore } from "./trace-live";

function contextOf(core: TraceCore, trace: RunTrace, subagentId: string) {
  return { ...core.ctx(trace), subagentId, sidechainAsMain: true };
}

function foldSource(
  core: TraceCore,
  port: SubagentPort,
  runId: string,
  id: string,
  lines: readonly string[],
) {
  const trace = core.traceOf(runId);
  const live = core.live(runId);
  const ctx = contextOf(core, trace, id);
  const folded = foldLines(live.subFolds.get(id) ?? emptyFold(), lines, ctx);
  const read = flushActions({ ...folded.state, pending: new Map() }, ctx);
  live.subFolds.set(id, { ...read.state, pending: folded.state.pending });
  core.write(runId, [...folded.moments, ...read.moments]);
  port.onLines(runId, id, lines);
}

export function flushSubagent(core: TraceCore, runId: string, id: string): void {
  const live = core.live(runId);
  const fold = live.subFolds.get(id);
  if (fold === undefined) return;
  live.subFolds.delete(id);
  core.write(runId, flushActions(fold, contextOf(core, core.traceOf(runId), id)).moments);
}

export function flushSubagents(core: TraceCore, runId: string): void {
  for (const id of [...core.live(runId).subFolds.keys()]) flushSubagent(core, runId, id);
}

function readSource(
  core: TraceCore,
  port: SubagentPort,
  runId: string,
  source: SubagentSource,
  budget: number,
) {
  const slice = port.read(source.path, source.offset, budget);
  const stuck = slice.lines.length === 0 && slice.more;
  if (stuck && budget >= core.passBytes) {
    const next = port.skip(source.path, source.offset);
    if (next !== null) port.advanced(runId, source, next, false);
    return { used: budget, more: next !== null };
  }
  if (slice.lines.length > 0) foldSource(core, port, runId, source.subagentId, slice.lines);
  const closed = source.ended && !slice.more;
  if (closed) flushSubagent(core, runId, source.subagentId);
  if (slice.offset !== source.offset || closed) port.advanced(runId, source, slice.offset, closed);
  return { used: slice.offset - source.offset, more: slice.more };
}

export function subagentPass(core: TraceCore, runId: string, budget: number): boolean {
  const port = core.deps.subagents;
  const trace = core.traceOf(runId);
  if (port === undefined || trace.source !== "transcript" || trace.path === null) return false;
  port.discover(runId, trace.path);
  let left = budget;
  let more = false;
  for (const source of port.sources(runId)) {
    if (left <= 0) return true;
    try {
      const read = readSource(core, port, runId, source, left);
      left -= read.used;
      more ||= read.more;
    } catch (e) {
      console.error(`[kibo-daemon] transcript of subagent ${source.subagentId} is unreadable`, e);
      port.advanced(runId, source, source.offset, true);
    }
  }
  return more;
}
