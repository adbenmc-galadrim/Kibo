import { KiboError, type RpcRequest } from "@kibo/schema";
import type { Orchestrator } from "./agents/orchestrator";
import { assertNotInboxForAgents } from "./inbox/inbox-rules";

export type AgentsPort = Pick<
  Orchestrator,
  | "assign"
  | "preview"
  | "answer"
  | "cancel"
  | "move"
  | "setPriority"
  | "setHost"
  | "state"
  | "log"
  | "activeRuns"
  | "onChange"
  | "onRunState"
>;

export function handleAgentRequest(port: AgentsPort, req: RpcRequest): unknown {
  switch (req.method) {
    case "getAgents":
      return port.state();
    case "getRunLog":
      return port.log(req.runId);
    case "previewAssign":
      assertNotInboxForAgents(req.projectId);
      return port.preview({ projectId: req.projectId, ticketId: req.ticketId, profileId: req.profileId });
    case "assignAgent":
      assertNotInboxForAgents(req.projectId);
      return port.assign({
        projectId: req.projectId,
        ticketId: req.ticketId,
        profileId: req.profileId,
        brief: req.brief,
        fresh: req.fresh,
      });
    case "answerRun":
      return port.answer(req.runId, req.text);
    case "cancelRun":
      return port.cancel(req.runId);
    case "moveRun":
      port.move(req.runId, req.index);
      return null;
    case "setRunPriority":
      port.setPriority(req.runId, req.priority);
      return null;
    case "setHost":
      return port.setHost(req.patch);
    default:
      throw new KiboError("INTERNAL", `${req.method} is not an agents method`);
  }
}
