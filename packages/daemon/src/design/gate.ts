import type { DesignFrame, StorybookOrigin } from "@kibo/schema";
import type { FrameService } from "./frame-service";
import type { StorybookOrigins } from "./storybook-origins";

export type DesignCallContext = { projectId: string; instanceId: string };
export type DesignGate = {
  frame(ctx: DesignCallContext, url: string, refresh: boolean): Promise<DesignFrame>;
  storybooks(ctx: DesignCallContext): Promise<StorybookOrigin[]>;
};

export function createDesignGate(
  service: Pick<FrameService, "frame">,
  origins: Pick<StorybookOrigins, "list">,
): DesignGate {
  return {
    frame: (ctx, url, refresh) => service.frame(ctx.instanceId, url, refresh, ctx.projectId),
    storybooks: (ctx) => origins.list(ctx.projectId),
  };
}
