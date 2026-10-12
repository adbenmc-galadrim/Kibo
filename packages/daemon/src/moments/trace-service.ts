import {
  type HookPayload,
  isTerminal,
  KiboError,
  type MomentData,
  maskSecretsWithin,
  type RunMoment,
  type RunMomentsPage,
  type RunPeek,
  type RunProgressSummary,
  type RunView,
  type TodoItem,
  todosToPlan,
} from "@kibo/schema";
import { hookMoments } from "./hook-group";
import type { RunTrace } from "./store";
import { createTraceCore, type TraceCore, type TraceDeps } from "./trace-live";
import { pageOf, peekOf } from "./trace-read";
import { drain, pass, resolve, toHooks } from "./trace-source";

export type { TraceDeps } from "./trace-live";
export type TraceService = {
  onHook(run: RunView, payload: HookPayload): Promise<void>;
  onTurnEnd(run: RunView): Promise<void>;
  note(runId: string, data: MomentData): RunMoment;
  setDoingStep(runId: string, stepId: string | null): void;
  setBaseHead(runId: string, head: string | null): void;
  trace(runId: string): RunTrace | null;
  page(runId: string, after?: number): RunMomentsPage;
  peek(run: RunView, progress: RunProgressSummary | null): RunPeek;
};

const PASS_EVENTS: ReadonlySet<string> = new Set(["PostToolUse", "Stop", "SubagentStop", "Notification"]);
const STEP_TITLE_MAX = 160;
export const HELD_MOMENTS_MAX = 20;

const maskedPlan = (todos: readonly TodoItem[]) =>
  todosToPlan(todos).map((step) => ({ ...step, title: maskSecretsWithin(step.title, STEP_TITLE_MAX) }));

function hookStep(core: TraceCore, runId: string, payload: HookPayload): void {
  const trace = core.traceOf(runId);
  if (trace.source === "transcript") return;
  const state = core.live(runId);
  const moments = hookMoments(state.group, payload, core.ctx(trace));
  if (trace.source === "hooks") core.write(runId, moments);
  else state.held.push(...moments);
  if (state.held.length > HELD_MOMENTS_MAX) toHooks(core, trace, "unreadable");
}

function settle(core: TraceCore, runId: string): RunTrace {
  const trace = core.traceOf(runId);
  if (trace.closedAt !== null) return trace;
  if (trace.source === "transcript") {
    pass(core, runId);
    core.flushFold(core.traceOf(runId), true);
  }
  if (core.traceOf(runId).source === "hooks")
    core.write(runId, core.live(runId).group.flush(core.ctx(trace)));
  return core.traceOf(runId);
}

function writeHeld(core: TraceCore, trace: RunTrace): void {
  const state = core.live(trace.runId);
  state.held.push(...state.group.flush(core.ctx(trace)));
  if (state.held.length > 0) toHooks(core, trace, "path-rejected");
}

function reopen(core: TraceCore, run: RunView): void {
  const trace = core.traceOf(run.id);
  if (trace.closedAt !== null && !isTerminal(run.state)) core.store.saveTrace({ ...trace, closedAt: null });
}

async function turnEnd(core: TraceCore, run: RunView): Promise<void> {
  reopen(core, run);
  const trace = core.traceOf(run.id);
  if (trace.closedAt !== null) return;
  if (run.transcriptPath !== null) resolve(core, trace, run, run.transcriptPath);
  await drain(core, run.id);
  const current = core.traceOf(run.id);
  if (current.source === "transcript") core.flushFold(current, false);
  if (current.source === "hooks") core.write(run.id, core.live(run.id).group.flush(core.ctx(current)));
  if (!isTerminal(run.state)) return;
  if (current.source === "pending") writeHeld(core, current);
  core.store.saveTrace({ ...core.traceOf(run.id), closedAt: core.deps.now() });
  core.lives.delete(run.id);
}

export function createTraceService(deps: TraceDeps): TraceService {
  const core = createTraceCore(deps);
  const { store } = core;
  return {
    async onHook(run, payload) {
      reopen(core, run);
      if (core.traceOf(run.id).closedAt !== null) return;
      if (payload.todos !== null) store.saveInternalPlan(run.id, maskedPlan(payload.todos), deps.now());
      if (!PASS_EVENTS.has(payload.event)) return;
      await core.enqueue(run.id, async () => {
        const trace = core.traceOf(run.id);
        if (trace.closedAt !== null) return;
        resolve(core, trace, run, payload.transcriptPath ?? run.transcriptPath);
        await drain(core, run.id);
        hookStep(core, run.id, payload);
      });
    },
    onTurnEnd: (run) => core.enqueue(run.id, () => turnEnd(core, run)),
    note(runId, data) {
      const trace = settle(core, runId);
      const [written] = core.write(runId, [core.moment(trace, data)]);
      if (!written) throw new KiboError("INTERNAL", `${data.kind} moment of run ${runId} was not written`);
      return written;
    },
    setDoingStep(runId, stepId) {
      if (core.traceOf(runId).doingStep === stepId) return;
      store.saveTrace({ ...settle(core, runId), doingStep: stepId });
    },
    setBaseHead(runId, head) {
      store.saveTrace({ ...core.traceOf(runId), baseHead: head });
    },
    trace: (runId) => store.trace(runId),
    page: (runId, after) => pageOf(store, runId, after),
    peek: (run, progress) => peekOf(store, run, progress),
  };
}
