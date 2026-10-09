import { z } from "zod";
import {
  ActionId,
  BATCH_COMMENT_MAX,
  type Batch,
  BatchDecisionKind,
  type ProjectAgentView,
} from "./project-agent";
import type { RpcRequest } from "./rpc";
import type { RunView } from "./run";

export const PROJECT_AGENT_MESSAGE_MAX = 10_000;

export const PROJECT_AGENT_RPC = [
  z.object({
    method: z.literal("getProjectAgent"),
    projectId: z.string().min(1),
    runId: z.string().min(1).optional(),
  }),
  z.object({
    method: z.literal("sendProjectAgentMessage"),
    projectId: z.string().min(1),
    text: z.string().trim().min(1).max(PROJECT_AGENT_MESSAGE_MAX),
  }),
  z.object({
    method: z.literal("decideBatch"),
    projectId: z.string().min(1),
    batchId: z.string().min(1),
    decision: BatchDecisionKind,
    actionIds: z.array(ActionId).optional(),
    comment: z.string().trim().max(BATCH_COMMENT_MAX).optional(),
  }),
  z.object({ method: z.literal("resetProjectAgent"), projectId: z.string().min(1) }),
] as const;

export type ProjectAgentRpcRequest = z.infer<(typeof PROJECT_AGENT_RPC)[number]>;

export type ProjectAgentRpcResult = {
  getProjectAgent: ProjectAgentView;
  sendProjectAgentMessage: RunView;
  decideBatch: Batch;
  resetProjectAgent: ProjectAgentView;
};

export const PROJECT_AGENT_METHODS: ReadonlySet<string> = new Set(
  PROJECT_AGENT_RPC.map((schema) => schema.shape.method.value),
);

export const isProjectAgentRequest = (req: RpcRequest): req is ProjectAgentRpcRequest =>
  PROJECT_AGENT_METHODS.has(req.method);
