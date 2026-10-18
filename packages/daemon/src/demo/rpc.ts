import { KiboError, type RpcRequest, type TutorialState } from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";
import type { TutorialService } from "./tutorial-service";

function answer(service: TutorialService, req: RpcRequest): TutorialState | Promise<TutorialState> {
  switch (req.method) {
    case "getTutorial":
      return service.get();
    case "startTutorial":
      return service.start();
    case "pauseTutorial":
      return service.pause();
    case "skipTutorial":
      return service.skip();
    case "resetTutorial":
      return service.reset();
    case "skipTutorialStep":
      return service.skipStep(req.step);
    case "markTutorialSeen":
      return service.markSeen(req.view);
    case "closeTutorial":
      return service.close();
    case "simulateTutorialReview":
      return service.simulateReview(req.projectId);
    default:
      throw new KiboError("INTERNAL", `tutorialRpc cannot handle ${req.method}`);
  }
}

export function tutorialRpc(service: TutorialService): RpcExtension {
  return {
    methods: [
      "getTutorial",
      "startTutorial",
      "pauseTutorial",
      "skipTutorial",
      "resetTutorial",
      "skipTutorialStep",
      "markTutorialSeen",
      "closeTutorial",
      "simulateTutorialReview",
    ],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      requireLocal(ctx);
      return answer(service, req);
    },
  };
}
