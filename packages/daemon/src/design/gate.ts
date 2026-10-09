import { type DesignFrame, KiboError, type StorybookOrigin } from "@kibo/schema";
import type { FrameService } from "./frame-service";

export type DesignCallContext = { projectId: string; instanceId: string };
export type DesignGate = {
  frame(ctx: DesignCallContext, url: string, refresh: boolean): Promise<DesignFrame>;
  storybooks(ctx: DesignCallContext): Promise<StorybookOrigin[]>;
};

export function createDesignGate(service: Pick<FrameService, "frame">): DesignGate {
  return {
    frame: (ctx, url, refresh) => service.frame(ctx.instanceId, url, refresh),
    storybooks: async () => {
      throw new KiboError("INTERNAL", "storybook origins not wired");
    },
  };
}
