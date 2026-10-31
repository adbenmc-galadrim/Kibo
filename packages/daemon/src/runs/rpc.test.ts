import { expect, test } from "bun:test";
import type { AgentsState, RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { type AgentQuestions, type AgentsPort, handleAgentRequest } from "./rpc";

function recordingPort(calls: string[]): AgentsPort {
  const record =
    (name: string) =>
    (..._args: unknown[]): never => {
      calls.push(name);
      throw new Error(`${name} should not be reached`);
    };
  return {
    answer: record("answer"),
    cancel: record("cancel"),
    move: record("move"),
    setPriority: record("setPriority"),
    setHost: record("setHost"),
    state: record("state"),
    log: record("log"),
    activeRuns: record("activeRuns"),
    onChange: record("onChange"),
    onRunState: record("onRunState"),
  };
}

function agentsPort(calls: string[], runs: RunView[]): AgentsPort {
  const port = recordingPort(calls);
  const state: AgentsState = {
    runs,
    queue: [],
    host: {
      hostSlots: 1,
      cpuThreshold: 85,
      ramThreshold: 90,
      paused: false,
      autoSlots: 1,
      slotsFixed: false,
      cores: 8,
      ramGb: 16,
      used: 0,
      cpu: 0,
      ram: 0,
    },
    tokensToday: 0,
    resumable: [],
    projectAgents: [],
  };
  return {
    ...port,
    state: () => state,
    answer(runId, text) {
      calls.push(`answer:${runId}:${text}`);
      return runs.find((r) => r.id === runId) ?? runView({ id: runId });
    },
  };
}

const questions: AgentQuestions = {
  projectAgents: () => [{ projectId: "p1", runId: "pa1", state: "running", pendingBatchId: "b1" }],
};

test("the agents state carries the project agents", () => {
  const state = handleAgentRequest(agentsPort([], []), { method: "getAgents" }, questions);
  expect(state).toMatchObject({
    projectAgents: [{ projectId: "p1", runId: "pa1", state: "running", pendingBatchId: "b1" }],
  });
});

test("a waiting project run is answered", () => {
  const calls: string[] = [];
  const project = runView({ id: "pa1", state: "waiting_input", kind: "project", ticketId: null });
  const port = agentsPort(calls, [project]);
  handleAgentRequest(port, { method: "answerRun", runId: "pa1", text: "oui" }, questions);
  expect(calls).toEqual(["answer:pa1:oui"]);
});
