import { isPlanRequest, KiboError, PLAN_RPC } from "@kibo/schema";
import { assertNotInbox } from "../inbox/inbox-rules";
import { type RpcExtension, requireLocal } from "../rpc-extensions";
import type { PlanService } from "./plan-service";

const METHODS = PLAN_RPC.map((schema) => schema.shape.method.value);

export function planRpc(service: PlanService): RpcExtension {
  return {
    methods: METHODS,
    async handle(req, ctx) {
      requireLocal(ctx);
      if (!isPlanRequest(req)) throw new KiboError("INTERNAL", `${req.method} is not a plan method`);
      assertNotInbox(req.projectId, "a plan");
      switch (req.method) {
        case "previewPlan":
          return service.preview(req.projectId, req.actions);
        case "applyPlan":
          return service.apply(req.projectId, req.actions);
      }
    },
  };
}
