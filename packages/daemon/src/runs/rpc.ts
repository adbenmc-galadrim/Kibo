import { type AgentsState, KiboError, type ProjectAgentSummary, type RpcRequest } from "@kibo/schema";
import type { Orchestrator } from "./orchestrator";

export type AgentsPort = Pick<
  Orchestrator,
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

export type AgentQuestions = { projectAgents(): ProjectAgentSummary[] };

const agentsState = (port: AgentsPort, q: AgentQuestions): AgentsState => ({
  ...port.state(),
  projectAgents: q.projectAgents(),
});

export function handleAgentRequest(port: AgentsPort, req: RpcRequest, q: AgentQuestions): unknown {
  switch (req.method) {
    case "getAgents":
      return agentsState(port, q);
    case "getRunLog":
      return port.log(req.runId);
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
