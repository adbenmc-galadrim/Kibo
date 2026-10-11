import type { RunView } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import type { TraceService } from "./trace-service";

export type TraceHookDeps = { trace: Pick<TraceService, "onHook">; run(runId: string): RunView | null };

export function withTrace(sink: HookSink, deps: TraceHookDeps): HookSink {
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      const reply = sink.receive(runId, payload, toolInput);
      const run = deps.run(runId);
      if (run)
        Promise.resolve()
          .then(() => deps.trace.onHook(run, payload))
          .catch((e: unknown) => {
            console.error(`[kibo-daemon] trace of run ${runId} failed`, e);
          });
      return reply;
    },
  };
}
