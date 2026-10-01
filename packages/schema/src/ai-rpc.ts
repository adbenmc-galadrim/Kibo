import { z } from "zod";
import {
  type AiStatus,
  type ComponentDraft,
  type ComponentDraftDetails,
  DraftId,
  type DraftPreview,
  type Environment,
  FinalizeComponentDraftInput,
  type FinalizeResult,
  ReviewComponentDraftInput,
  ReviseComponentDraftInput,
  Role,
  StartComponentDraftInput,
  StarterText,
} from "./ai";

export const AI_RPC = [
  z.object({ method: z.literal("getAiStatus") }),
  z.object({ method: z.literal("getEnvironment") }),
  z.object({ method: z.literal("suggestStarter"), role: Role, text: StarterText }),
  z.object({ method: z.literal("startComponentDraft"), draft: StartComponentDraftInput }),
  z.object({ method: z.literal("retryComponentDraft"), draftId: DraftId }),
  z.object({ method: z.literal("revalidateComponentDraft"), draftId: DraftId }),
  z.object({ method: z.literal("getComponentDraft"), draftId: DraftId }),
  z.object({ method: z.literal("listComponentDrafts") }),
  z.object({ method: z.literal("reviewComponentDraft"), ...ReviewComponentDraftInput.shape }),
  z.object({ method: z.literal("finalizeComponentDraft"), ...FinalizeComponentDraftInput.shape }),
  z.object({ method: z.literal("abandonComponentDraft"), draftId: DraftId }),
  z.object({ method: z.literal("openComponentDraftFolder"), draftId: DraftId }),
  z.object({ method: z.literal("reviseComponentDraft"), ...ReviseComponentDraftInput.shape }),
  z.object({ method: z.literal("previewComponentDraft"), draftId: DraftId }),
] as const;

export type AiRpcRequest = z.infer<(typeof AI_RPC)[number]>;

export type AiRpcResult = {
  getAiStatus: AiStatus;
  getEnvironment: Environment;
  suggestStarter: { runId: string };
  startComponentDraft: ComponentDraft;
  retryComponentDraft: ComponentDraft;
  revalidateComponentDraft: ComponentDraft;
  getComponentDraft: ComponentDraftDetails;
  listComponentDrafts: ComponentDraft[];
  reviewComponentDraft: ComponentDraftDetails;
  finalizeComponentDraft: FinalizeResult;
  abandonComponentDraft: null;
  openComponentDraftFolder: null;
  reviseComponentDraft: ComponentDraft;
  previewComponentDraft: DraftPreview;
};
