import { z } from "zod";
import { AddDirs } from "./add-dir";
import { type Agent, AgentRef } from "./agent";
import { AgentPresetId } from "./agent-preset";
import { AllowRules } from "./allow-rule";
import { AbsPath, DeliveryStepNumber, type ProjectDelivery } from "./delivery";
import type { DeliveryItem } from "./delivery-order";
import type { RunDenials } from "./denial";
import { NodeId, TicketKey } from "./ids";
import type { ProjectMeta } from "./project";
import type { TicketView } from "./rpc";
import type { RunView } from "./run";
import type { WorktreeSettings } from "./worktree";

const ProjectId = z.string().min(1);
const RunId = z.string().min(1);

export const DELIVERY_RPC = [
  z.object({ method: z.literal("agents.applyPreset"), ref: AgentRef, preset: AgentPresetId }),
  z.object({ method: z.literal("deliver"), projectId: ProjectId, ticketId: NodeId }),
  z.object({
    method: z.literal("setDeliveryStep"),
    projectId: ProjectId,
    ticketKey: TicketKey,
    step: DeliveryStepNumber,
    note: z.string().max(300).optional(),
  }),
  z.object({ method: z.literal("runs.denials"), runId: RunId }),
  z.object({
    method: z.literal("runs.allowAndResume"),
    runId: RunId,
    questionId: NodeId,
    rules: AllowRules,
    addDirs: AddDirs,
  }),
  z.object({ method: z.literal("projects.importDelivery"), registryPath: AbsPath.optional() }),
  z.object({
    method: z.literal("projects.applyDeliveryImport"),
    projectId: ProjectId,
    name: z.string().min(1).max(200),
    registryPath: AbsPath.optional(),
  }),
] as const;

export type DeliveryRpcRequest = z.infer<(typeof DELIVERY_RPC)[number]>;
export const DELIVERY_RPC_METHODS: readonly DeliveryRpcRequest["method"][] = DELIVERY_RPC.map(
  (schema) => schema.shape.method.value,
);

export const isDeliveryRequest = (req: { method: string }): req is DeliveryRpcRequest =>
  DELIVERY_RPC_METHODS.some((method) => method === req.method);

export type DeliverResult = RunView | { kind: "parent"; items: DeliveryItem[] };
export type DeliveryImportCandidate = {
  name: string;
  repo: string;
  remote: string | null;
  matched: string | null;
  preview: { worktree: WorktreeSettings; delivery: ProjectDelivery };
  notices: string[];
};

export type DeliveryRpcResult = {
  "agents.applyPreset": Agent;
  deliver: DeliverResult;
  setDeliveryStep: TicketView;
  "runs.denials": RunDenials | null;
  "runs.allowAndResume": { agent: Agent; run: RunView };
  "projects.importDelivery": { registryPath: string; candidates: DeliveryImportCandidate[] };
  "projects.applyDeliveryImport": ProjectMeta;
};
