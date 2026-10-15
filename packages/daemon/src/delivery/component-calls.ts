import { type ComponentCall, KiboError } from "@kibo/schema";
import type { DeliveryOps } from "./delivery-ops";

export type DeliveryCall = Extract<
  ComponentCall,
  { kind: "run.deliver" | "run.denials" | "run.deliveryAgent" | "run.allowAndResume" }
>;
export type ComponentDelivery = { call(projectId: string, call: DeliveryCall): unknown };

function ownRun(ops: DeliveryOps, projectId: string, runId: string): void {
  if (ops.run(runId).projectId !== projectId) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
}

export function componentDelivery(ops: DeliveryOps): ComponentDelivery {
  return {
    call(projectId, call) {
      switch (call.kind) {
        case "run.deliver":
          return ops.deliver(projectId, call.ticketId);
        case "run.deliveryAgent":
          return ops.deliveryAgent(projectId);
        case "run.denials":
          ownRun(ops, projectId, call.runId);
          return ops.denials(call.runId);
        case "run.allowAndResume": {
          ownRun(ops, projectId, call.runId);
          const { kind: _kind, ...input } = call;
          return ops.allowAndResume(input);
        }
      }
    },
  };
}
