import {
  answersToDeliver,
  isTerminal,
  KiboError,
  type ProjectAgentSummary,
  type RpcRequest,
  type RunProgressSummary,
  type RunView,
} from "@kibo/schema";
import { answerFromDrawer, type DeliveryDeps } from "./agents/question-delivery";
import { assertNotInboxForAgents } from "./inbox/inbox-rules";
import { runTallies } from "./questions/run-tallies";
import type { AgentDataPort, Orchestrator } from "./runs/orchestrator";
import type { SignalService } from "./signals/service";

export type AgentsPort = Pick<
  Orchestrator,
  | "ticketExecution"
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
  projectIds(): readonly string[];
  projectAgents(): ProjectAgentSummary[];
  viewer(projectId: string): string;
  assertWritable(projectId: string): void;
};

export type RunProgressPort = { summaries(runs: readonly RunView[]): RunProgressSummary[] };

export const PROGRESS_WINDOW_MS = 24 * 3_600_000;

export function withRunProgress(
  port: AgentsPort,
  progress: RunProgressPort,
  now: () => number = Date.now,
): AgentsPort {
  return {
    ...port,
    state() {
      const state = port.state();
      const since = now() - PROGRESS_WINDOW_MS;
      const shown = state.runs.filter((r) => !isTerminal(r.state) || (r.endedAt ?? 0) >= since);
      return { ...state, progress: progress.summaries(shown) };
    },
  };
}

export function withSignalCounts(port: AgentsPort, signals: Pick<SignalService, "counts">): AgentsPort {
  return {
    ...port,
    state: () => ({ ...port.state(), signals: signals.counts() }),
  };
}

export function deliveryDeps(
  port: Pick<AgentsPort, "state" | "answer" | "ticketExecution">,
  q: AgentQuestions,
): DeliveryDeps {
  return {
    ticketExecution: port.ticketExecution(),
    runs: () => port.state().runs,
    answer: (runId, text) => port.answer(runId, text),
    data: q.data,
  };
}

function agentsState(port: AgentsPort, q: AgentQuestions) {
  const state = port.state();
  const known = new Set(q.projectIds());
  const undeliveredOf = (projectId: string, ticketId: string) =>
    known.has(projectId)
      ? answersToDeliver(q.data.undeliveredAnswers(projectId, ticketId), ticketId).length
      : 0;
  return {
    ...state,
    questions: runTallies(q.data.runQuestions(), state.runs, undeliveredOf),
    projectAgents: q.projectAgents(),
  };
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
