import { KiboError, type ProjectCommand, type RpcRequest } from "@kibo/schema";
import type { CommandInterceptor } from "../docs";
import type { RpcHandler } from "../rpc-extensions";

type IsDemo = (projectId: string) => boolean;

const staysLocal = () => new KiboError("INVALID_INPUT", "the demo project stays local");

const leavesTheMachine = (command: ProjectCommand): boolean => command.method === "addBinding";

function targetsOutside(req: RpcRequest): string | null {
  switch (req.method) {
    case "shareProject":
    case "createProjectInvite":
    case "createBinding":
      return req.projectId;
    case "updateProject":
      return typeof req.patch.folder === "string" ? req.projectId : null;
    case "command":
      return leavesTheMachine(req.command) ? req.projectId : null;
    default:
      return null;
  }
}

export function demoRpcGuard(isDemo: IsDemo): RpcHandler {
  return async (req) => {
    const projectId = targetsOutside(req);
    if (projectId !== null && isDemo(projectId)) throw staysLocal();
    return { handled: false };
  };
}

export function demoCommandGuard(isDemo: IsDemo): CommandInterceptor {
  return (projectId, command) => {
    if (leavesTheMachine(command) && isDemo(projectId)) throw staysLocal();
    return command;
  };
}
