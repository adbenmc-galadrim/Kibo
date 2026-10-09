import { isProjectAgentRequest, KiboError, PROJECT_AGENT_RPC } from "@kibo/schema";
import { assertNotInboxForAgents } from "../inbox/inbox-rules";
import { type RpcExtension, requireLocal } from "../rpc-extensions";
import type { ProjectAgentCore } from "./service";

const METHODS = PROJECT_AGENT_RPC.map((schema) => schema.shape.method.value);

export function projectAgentRpc(
  service: Pick<ProjectAgentCore, "view" | "send" | "decide" | "reset">,
): RpcExtension {
  return {
    methods: METHODS,
    async handle(req, ctx) {
      requireLocal(ctx);
      if (!isProjectAgentRequest(req))
        throw new KiboError("INTERNAL", `${req.method} is not a project agent method`);
      assertNotInboxForAgents(req.projectId);
      switch (req.method) {
        case "getProjectAgent":
          return service.view(req.projectId, req.runId);
        case "sendProjectAgentMessage":
          return service.send(req.projectId, req.text);
        case "decideBatch": {
          const { method: _method, ...input } = req;
          return service.decide(input);
        }
        case "resetProjectAgent":
          return service.reset(req.projectId);
      }
    },
  };
}
