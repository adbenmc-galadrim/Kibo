import { type DeliveryResult, KiboError, type RpcRequest, type RunView } from "@kibo/schema";
import type { AgentDataPort, Orchestrator } from "./agents/orchestrator";
import { answerFromDrawer, type DeliveryDeps, deliverAnswers } from "./agents/question-delivery";
import { assertNotInboxForAgents } from "./inbox/inbox-rules";
import { runTallies } from "./questions/run-tallies";

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

export type AgentQuestions = {
  data: Pick<
    AgentDataPort,
    "runQuestions" | "undeliveredAnswers" | "markAnswersDelivered" | "answerRunQuestion"
  >;
  viewer(projectId: string): string;
  assertWritable(projectId: string): void;
};

export function deliveryDeps(port: Pick<AgentsPort, "state" | "answer">, q: AgentQuestions): DeliveryDeps {
  return { runs: () => port.state().runs, answer: (runId, text) => port.answer(runId, text), data: q.data };
}

export function deliverTicketAnswers(
  port: Pick<AgentsPort, "state" | "answer">,
  q: AgentQuestions,
  projectId: string,
  ticketId: string,
): DeliveryResult {
  assertNotInboxForAgents(projectId);
  q.assertWritable(projectId);
  return deliverAnswers(deliveryDeps(port, q), projectId, ticketId);
}

function agentsState(port: AgentsPort, q: AgentQuestions) {
  const state = port.state();
  const undeliveredOf = (projectId: string, ticketId: string) =>
    q.data.undeliveredAnswers(projectId, ticketId).length;
  return { ...state, questions: runTallies(q.data.runQuestions(), state.runs, undeliveredOf) };
}

function answerRun(port: AgentsPort, q: AgentQuestions, runId: string, text: string): RunView {
  const run = port.state().runs.find((r) => r.id === runId);
  if (!run?.projectId || run.state !== "waiting_input") return port.answer(runId, text);
  return answerFromDrawer(deliveryDeps(port, q), run, text, { kind: "human", ref: q.viewer(run.projectId) });
}

export function handleAgentRequest(port: AgentsPort, req: RpcRequest, q: AgentQuestions): unknown {
  switch (req.method) {
    case "getAgents":
      return agentsState(port, q);
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
      return answerRun(port, q, req.runId, req.text);
    case "deliverAnswers":
      return deliverTicketAnswers(port, q, req.projectId, req.ticketId);
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
