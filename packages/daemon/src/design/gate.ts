import type { DesignFrame } from "@kibo/schema";
import type { FrameService } from "./frame-service";

export type DesignCallContext = { projectId: string; instanceId: string };
export type DesignGate = {
  frame(ctx: DesignCallContext, url: string, refresh: boolean): Promise<DesignFrame>;
};

export function createDesignGate(service: Pick<FrameService, "frame">): DesignGate {
  return { frame: (ctx, url, refresh) => service.frame(ctx.instanceId, url, refresh) };
}
