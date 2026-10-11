import type { ComponentCall, EntityType, RunPeek } from "@kibo/schema";
import type { RunsApi, SdkContext } from "./types";

type Call = <T>(c: ComponentCall) => Promise<T>;

export function runsApi(needRead: (entity: EntityType) => void, call: Call): RunsApi {
  return {
    async peek(runId) {
      needRead("run");
      return call<RunPeek>({ kind: "run.peek", runId });
    },
  };
}

export function openRunOf(ctx: SdkContext): (runId: string) => void {
  return (runId) => {
    if (ctx.openRun) ctx.openRun(runId);
    else console.warn(`[kibo-sdk] ${ctx.instanceId}: no host to open run ${runId}`);
  };
}
