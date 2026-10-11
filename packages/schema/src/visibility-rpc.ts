import { z } from "zod";
import type { RunMomentsPage, RunPeek } from "./moment";

export const VISIBILITY_RPC = [
  z.object({
    method: z.literal("runMoments"),
    runId: z.string().min(1),
    after: z.number().int().nonnegative().optional(),
  }),
  z.object({ method: z.literal("runPeek"), runId: z.string().min(1) }),
] as const;

export type VisibilityRpcRequest = z.infer<(typeof VISIBILITY_RPC)[number]>;
export type VisibilityRpcResult = { runMoments: RunMomentsPage; runPeek: RunPeek };

const VISIBILITY_METHODS: ReadonlySet<string> = new Set(
  VISIBILITY_RPC.map((schema) => schema.shape.method.value),
);

export const isVisibilityRequest = (req: { method: string }): boolean => VISIBILITY_METHODS.has(req.method);
