import type {
  ComponentCall,
  DeliverResult,
  DeliveryAgent,
  EntityType,
  RunDenials,
  RunPeek,
} from "@kibo/schema";
import type { RunsApi, SdkContext } from "./types";

type Call = <T>(c: ComponentCall) => Promise<T>;
type Needs = { read(entity: EntityType): void; write(entity: EntityType): void };

export function runsApi(needs: Needs, call: Call): RunsApi {
  return {
    async peek(runId) {
      needs.read("run");
      return call<RunPeek>({ kind: "run.peek", runId });
    },
    async deliver(ticketId) {
      needs.write("run");
      return call<DeliverResult>({ kind: "run.deliver", ticketId });
    },
    async denials(runId) {
      needs.read("run");
      return call<RunDenials | null>({ kind: "run.denials", runId });
    },
    async deliveryAgent() {
      needs.read("run");
      return call<DeliveryAgent | null>({ kind: "run.deliveryAgent" });
    },
    async allowAndResume(input) {
      needs.write("run");
      await call<unknown>({ kind: "run.allowAndResume", ...input });
    },
  };
}

export function openRunOf(ctx: SdkContext): (runId: string) => void {
  return (runId) => {
    if (ctx.openRun) ctx.openRun(runId);
    else console.warn(`[kibo-sdk] ${ctx.instanceId}: no host to open run ${runId}`);
  };
}
