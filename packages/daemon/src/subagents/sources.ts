import { basename, join } from "node:path";
import { subagentSignals } from "@kibo/core";
import type { SubagentPort } from "../moments/trace-live";
import type { SubagentStore } from "./store";
import {
  listSubagentMetas,
  readSubagentMeta,
  readSubagentSlice,
  skipLongSubagentLine,
  subagentDir,
} from "./trace";
import type { SubagentTracker } from "./tracker";

export type SubagentSourcesDeps = {
  store: SubagentStore;
  tracker: SubagentTracker;
  root: string;
  now: () => number;
};
export type SubagentSources = SubagentPort & { forget(runId: string): void };

export function createSubagentSources(deps: SubagentSourcesDeps): SubagentSources {
  const { store, tracker, root } = deps;
  const seen = new Map<string, Set<string>>();

  function discover(runId: string, transcriptPath: string): void {
    const dir = subagentDir(transcriptPath, basename(transcriptPath, ".jsonl"));
    const known = seen.get(runId) ?? new Set<string>();
    seen.set(runId, known);
    for (const agentId of listSubagentMetas(root, dir)) {
      if (known.has(agentId)) continue;
      known.add(agentId);
      const meta = readSubagentMeta(root, join(dir, `agent-${agentId}.meta.json`), agentId);
      if (meta) tracker.onMeta(runId, meta);
    }
  }

  return {
    discover(runId, transcriptPath) {
      try {
        discover(runId, transcriptPath);
      } catch (e) {
        console.error(`[kibo-daemon] subagents of run ${runId} are not listed`, e);
      }
    },
    sources: (runId) =>
      store.list(runId).flatMap((s) => {
        const trace = store.trace(s.id);
        if (s.transcriptPath === null || (trace !== null && trace.closedAt !== null)) return [];
        return [
          {
            subagentId: s.id,
            path: s.transcriptPath,
            offset: trace?.offset ?? 0,
            ended: s.state !== "running",
          },
        ];
      }),
    read: (path, offset, maxBytes) => readSubagentSlice(root, path, offset, maxBytes),
    skip: (path, offset) => skipLongSubagentLine(root, path, offset),
    advanced(runId, source, offset, closed) {
      store.saveTrace({
        subagentId: source.subagentId,
        runId,
        path: source.path,
        offset,
        closedAt: closed ? deps.now() : null,
      });
    },
    onLines(runId, subagentId, lines) {
      if (subagentId !== null) tracker.onSlice(runId, subagentId, lines);
      const signals = subagentSignals(lines);
      if (subagentId !== null && signals.model !== null) tracker.onModel(subagentId, signals.model);
      for (const launch of signals.launches) tracker.onLaunch(runId, launch, subagentId);
      for (const result of signals.results)
        tracker.onResult(runId, result.toolUseId, result.isError, result.text);
    },
    forget: (runId) => seen.delete(runId),
  };
}
