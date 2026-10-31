import { z } from "zod";
import { PlanActions, type PlanOutcome, type PlanPreview } from "./plan";
import type { RpcRequest } from "./rpc";

export const PLAN_RPC = [
  z.object({ method: z.literal("previewPlan"), projectId: z.string().min(1), actions: PlanActions }),
  z.object({ method: z.literal("applyPlan"), projectId: z.string().min(1), actions: PlanActions }),
] as const;

type PlanRpcRequest = z.infer<(typeof PLAN_RPC)[number]>;

export type PlanRpcResult = { previewPlan: PlanPreview; applyPlan: PlanOutcome };

export const PLAN_METHODS: ReadonlySet<string> = new Set(PLAN_RPC.map((schema) => schema.shape.method.value));

export const isPlanRequest = (req: RpcRequest): req is PlanRpcRequest => PLAN_METHODS.has(req.method);
