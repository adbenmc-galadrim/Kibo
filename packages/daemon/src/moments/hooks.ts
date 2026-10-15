import type { HookPayload, RunView } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import type { SubagentTracker } from "../subagents/tracker";
import type { TraceService } from "./trace-service";

export type TraceHookDeps = {
  trace: Pick<TraceService, "onHook">;
  run(runId: string): RunView | null;
  subagents?: Pick<SubagentTracker, "onHook">;
};

const SUBAGENT_EVENTS: ReadonlySet<HookPayload["event"]> = new Set(["SubagentStart", "SubagentStop"]);

function trackSubagent(deps: TraceHookDeps, runId: string, payload: HookPayload): void {
  if (!deps.subagents || !SUBAGENT_EVENTS.has(payload.event)) return;
  try {
    deps.subagents.onHook(runId, payload);
  } catch (e) {
    console.error(`[kibo-daemon] subagent of run ${runId} was not tracked`, e);
  }
}

export function withTrace(sink: HookSink, deps: TraceHookDeps): HookSink {
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      const reply = sink.receive(runId, payload, toolInput);
      const run = deps.run(runId);
      if (!run) return reply;
      trackSubagent(deps, runId, payload);
      Promise.resolve()
        .then(() => deps.trace.onHook(run, payload))
        .catch((e: unknown) => {
          console.error(`[kibo-daemon] trace of run ${runId} failed`, e);
        });
      return reply;
    },
  };
}
