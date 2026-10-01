import {
  AI_RPC,
  type AiRpcRequest,
  type Environment,
  KiboError,
  type Role,
  type RpcRequest,
} from "@kibo/schema";
import type { DraftLifecycle } from "./draft-lifecycle";
import type { createDraftPublisher } from "./draft-publish";
import type { AiAvailability } from "./ports";

export type DraftPublisher = ReturnType<typeof createDraftPublisher>;
export type AiPort = { handle(req: AiRpcRequest): Promise<unknown> };
export type AiRpcDeps = {
  ai: AiAvailability;
  environment: () => Promise<Environment>;
  starter: { suggest(input: { role: Role; text: string }): { runId: string } };
  lifecycle: DraftLifecycle;
  publisher: DraftPublisher;
};

export const AI_METHODS: ReadonlySet<string> = new Set(AI_RPC.map((s) => s.shape.method.value));

export const isAiRequest = (req: RpcRequest): req is AiRpcRequest => AI_METHODS.has(req.method);

export function createAiRpc(deps: AiRpcDeps): AiPort {
  const assertIdle = (draftId: string) => {
    if (deps.publisher.isProcessing(draftId))
      throw new KiboError("CONFLICT", "this draft is being reviewed or published; try again once it is done");
  };
  const abandon = (draftId: string) => {
    assertIdle(draftId);
    return deps.lifecycle.abandon(draftId);
  };

  const route = async (req: AiRpcRequest): Promise<unknown> => {
    switch (req.method) {
      case "getAiStatus":
        return deps.ai.settled();
      case "getEnvironment":
        return deps.environment();
      case "suggestStarter":
        await deps.ai.settled();
        return deps.starter.suggest({ role: req.role, text: req.text });
      case "startComponentDraft":
        await deps.ai.settled();
        return deps.lifecycle.start(req.draft);
      case "retryComponentDraft":
        await deps.ai.settled();
        return deps.lifecycle.retry(req.draftId);
      case "revalidateComponentDraft":
        return deps.lifecycle.revalidate(req.draftId);
      case "getComponentDraft":
        return deps.publisher.details(req.draftId);
      case "listComponentDrafts":
        return deps.lifecycle.list();
      case "reviewComponentDraft":
        return deps.publisher.review({ draftId: req.draftId, version: req.version, changes: req.changes });
      case "finalizeComponentDraft":
        return deps.publisher.finalize({
          draftId: req.draftId,
          version: req.version,
          hash: req.hash,
          trust: req.trust,
          strategy: req.strategy,
          target: req.target,
        });
      case "abandonComponentDraft":
        return abandon(req.draftId);
      case "openComponentDraftFolder":
        return deps.lifecycle.openFolder(req.draftId);
      case "reviseComponentDraft":
        assertIdle(req.draftId);
        await deps.ai.settled();
        assertIdle(req.draftId);
        return deps.lifecycle.revise({
          draftId: req.draftId,
          feedback: req.feedback,
          attachments: req.attachments,
        });
      case "previewComponentDraft":
        throw new KiboError("INTERNAL", "the draft preview is not served by this daemon yet");
    }
  };
  return { handle: route };
}
