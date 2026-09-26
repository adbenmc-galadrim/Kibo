import type { AiEvent } from "@kibo/schema";
import type { AgentRunRequest, AgentRuns, AiEvents, Clock, RunEnd, RunState } from "../ports";

export type FakeRun = { id: string; req: AgentRunRequest; state: RunState };
export type FakeRuns = AgentRuns & {
  runs: FakeRun[];
  cancelled: string[];
  setState(runId: string, state: RunState): void;
  end(runId: string, end: RunEnd): void;
};

export function createFakeRuns(): FakeRuns {
  const runs: FakeRun[] = [];
  const cancelled: string[] = [];
  const stateListeners = new Map<string, Set<(s: RunState) => void>>();
  const endListeners = new Map<string, Set<(e: RunEnd) => void>>();
  const ended = new Map<string, RunEnd>();
  const find = (id: string) => runs.find((r) => r.id === id);
  const end = (runId: string, e: RunEnd) => {
    const run = find(runId);
    if (!run || ended.has(runId)) return;
    ended.set(runId, e);
    run.state = e.state;
    for (const l of [...(endListeners.get(runId) ?? [])]) l(e);
  };
  return {
    runs,
    cancelled,
    enqueue(req) {
      const id = `run-${runs.length + 1}`;
      runs.push({ id, req, state: "queued" });
      return id;
    },
    cancel(runId) {
      if (ended.has(runId)) return;
      cancelled.push(runId);
      end(runId, { state: "cancelled", sessionId: null, stdout: "", error: null });
    },
    state: (runId) => find(runId)?.state ?? null,
    onState(runId, listener) {
      const set = stateListeners.get(runId) ?? new Set();
      set.add(listener);
      stateListeners.set(runId, set);
      return () => set.delete(listener);
    },
    onEnd(runId, listener) {
      const done = ended.get(runId);
      if (done) {
        listener(done);
        return () => {};
      }
      const set = endListeners.get(runId) ?? new Set();
      set.add(listener);
      endListeners.set(runId, set);
      return () => set.delete(listener);
    },
    setState(runId, state) {
      const run = find(runId);
      if (!run) return;
      run.state = state;
      for (const l of [...(stateListeners.get(runId) ?? [])]) l(state);
    },
    end,
  };
}

export function createFakeClock(start = 1_000): Clock & { advance(ms: number): void } {
  let now = start;
  const timers: { at: number; fn: () => void; alive: boolean }[] = [];
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const t = { at: now + ms, fn, alive: true };
      timers.push(t);
      return () => {
        t.alive = false;
      };
    },
    advance(ms) {
      now += ms;
      for (const t of timers.filter((x) => x.alive && x.at <= now)) {
        t.alive = false;
        t.fn();
      }
    },
  };
}

export function createRecordingEvents(): AiEvents & { events: AiEvent[] } {
  const events: AiEvent[] = [];
  return { events, publish: (e) => events.push(e) };
}
