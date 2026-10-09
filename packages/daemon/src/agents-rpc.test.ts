import { expect, test } from "bun:test";
import { type AgentsState, INBOX_ID, type Question, type RpcRequest, type RunView } from "@kibo/schema";
import { type AgentQuestions, type AgentsPort, handleAgentRequest } from "./agents-rpc";
import { answered, HUMAN, runView } from "./questions/questions.test-helper";

function recordingPort(calls: string[]): AgentsPort {
  const record =
    (name: string) =>
    (..._args: unknown[]): never => {
      calls.push(name);
      throw new Error(`${name} should not be reached`);
    };
  return {
    assign: record("assign"),
    preview: record("preview"),
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

function questionsStub(calls: string[], undelivered: Question[] = [], blocking: Question | null = null) {
  const questions: AgentQuestions = {
    data: {
      runQuestions: () => [{ runId: "r1", open: 1, undelivered: 0, latestTitle: "Quel port ?" }],
      undeliveredAnswers: () => undelivered,
      markAnswersDelivered: (projectId, ticketId, ids, runId) =>
        calls.push(`mark:${projectId}:${ticketId}:${ids.join(",")}:${runId}`),
      answerRunQuestion(projectId, runId, text, by) {
        calls.push(`drawer:${projectId}:${runId}:${text}:${by.kind}:${by.ref}`);
        return blocking;
      },
    },
    projectIds: () => ["p1"],
    viewer: () => HUMAN.ref,
    assertWritable: (projectId) => calls.push(`writable:${projectId}`),
  };
  return questions;
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
    questions: [],
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

test("the agents state carries the question counts of the runs", () => {
  const calls: string[] = [];
  const state = handleAgentRequest(agentsPort(calls, []), { method: "getAgents" }, questionsStub(calls));
  expect(state).toMatchObject({
    questions: [{ runId: "r1", open: 1, undelivered: 0, latestTitle: "Quel port ?" }],
    projectAgents: [],
  });
});

test("answering a waiting run from the drawer answers its blocking question, then marks it once sent", () => {
  const calls: string[] = [];
  const waiting = runView({ id: "r1", state: "waiting_input" });
  const port = agentsPort(calls, [waiting, runView({ id: "r2", state: "running" })]);
  const questions = questionsStub(calls, [], answered("q1", { blocking: true }));
  handleAgentRequest(port, { method: "answerRun", runId: "r1", text: "443" }, questions);
  expect(calls).toEqual(["drawer:p1:r1:443:human:adam", "answer:r1:443", "mark:p1:t1:q1:r1"]);
  calls.length = 0;
  handleAgentRequest(port, { method: "answerRun", runId: "r2", text: "et les tests ?" }, questions);
  expect(calls).toEqual(["answer:r2:et les tests ?"]);
});

test("delivering the answers of a ticket checks the project, sends one message and marks them", () => {
  const calls: string[] = [];
  const port = agentsPort(calls, [runView({ id: "r1" })]);
  const questions = questionsStub(calls, [answered("q1", { at: 1 }), answered("q2", { at: 2 })]);
  expect(
    handleAgentRequest(port, { method: "deliverAnswers", projectId: "p1", ticketId: "t1" }, questions),
  ).toEqual({
    sent: 2,
    runId: "r1",
  });
  expect(calls[0]).toBe("writable:p1");
  expect(calls.slice(2)).toEqual(["mark:p1:t1:q1,q2:r1"]);
  expect(() =>
    handleAgentRequest(port, { method: "deliverAnswers", projectId: INBOX_ID, ticketId: "1@1" }, questions),
  ).toThrow("inbox tickets cannot be assigned to an agent");
});

test("an inbox ticket is never handed to the orchestrator", () => {
  const calls: string[] = [];
  const port = recordingPort(calls);
  const requests: RpcRequest[] = [
    { method: "previewAssign", projectId: INBOX_ID, ticketId: "1@1", profileId: "dev" },
    {
      method: "assignAgent",
      projectId: INBOX_ID,
      ticketId: "1@1",
      profileId: "dev",
      brief: "",
      fresh: false,
    },
  ];
  for (const req of requests)
    expect(() => handleAgentRequest(port, req, questionsStub(calls))).toThrow(
      "inbox tickets cannot be assigned to an agent",
    );
  expect(calls).toEqual([]);
});

test("a project ticket still reaches the orchestrator", () => {
  const calls: string[] = [];
  const port = recordingPort(calls);
  expect(() =>
    handleAgentRequest(
      port,
      { method: "previewAssign", projectId: "p1", ticketId: "1@1", profileId: "dev" },
      questionsStub(calls),
    ),
  ).toThrow("preview should not be reached");
  expect(calls).toEqual(["preview"]);
});
