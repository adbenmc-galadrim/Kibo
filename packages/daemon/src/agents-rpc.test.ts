import { expect, test } from "bun:test";
import { type AgentsState, INBOX_ID, type Question, type RpcRequest, type RunView } from "@kibo/schema";
import {
  type AgentQuestions,
  type AgentsPort,
  handleAgentRequest,
  withRunProgress,
  withSignalCounts,
} from "./agents-rpc";
import { answered, HUMAN, runView } from "./questions/questions.test-helper";

const IMPORT = { kind: "import", ref: "plan" } as const;

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
    projectAgents: () => [{ projectId: "p1", runId: "pa1", state: "running", pendingBatchId: "b1" }],
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
    progress: [],
    signals: [],
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

test("the agents state carries the question counts of the runs and the project agents", () => {
  const calls: string[] = [];
  const state = handleAgentRequest(agentsPort(calls, []), { method: "getAgents" }, questionsStub(calls));
  expect(state).toMatchObject({
    questions: [{ runId: "r1", open: 1, undelivered: 0, latestTitle: "Quel port ?" }],
    projectAgents: [{ projectId: "p1", runId: "pa1", state: "running", pendingBatchId: "b1" }],
  });
});

test("the drawer counts only the answers given in Kibo as waiting for delivery", () => {
  const calls: string[] = [];
  const ended = runView({ id: "r1", state: "done" });
  const fromPlan = answered("q1");
  const imported = { ...fromPlan, answer: fromPlan.answer && { ...fromPlan.answer, by: IMPORT } };
  const onlyImported = handleAgentRequest(
    agentsPort(calls, [ended]),
    { method: "getAgents" },
    questionsStub(calls, [imported]),
  );
  expect(onlyImported).toMatchObject({ questions: [{ runId: "r1", open: 1, undelivered: 0 }] });
  const withHuman = handleAgentRequest(
    agentsPort(calls, [ended]),
    { method: "getAgents" },
    questionsStub(calls, [imported, answered("q2")]),
  );
  expect(withHuman).toMatchObject({ questions: [{ runId: "r1", open: 1, undelivered: 1 }] });
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

test("a project ticket is refused without reaching the orchestrator", () => {
  const calls: string[] = [];
  const port = recordingPort(calls);
  expect(() =>
    handleAgentRequest(
      port,
      { method: "previewAssign", projectId: "p1", ticketId: "1@1", profileId: "dev" },
      questionsStub(calls),
    ),
  ).toThrow("AGENT_EXECUTION_REMOVED");
  expect(calls).toEqual([]);
});

test("the agents state carries the progress of the live runs and of the runs ended within 24 h", () => {
  const now = 100 * 3_600_000;
  const runs = [
    runView({ id: "live", state: "running" }),
    runView({ id: "recent", state: "done", endedAt: now - 23 * 3_600_000 }),
    runView({ id: "old", state: "done", endedAt: now - 25 * 3_600_000 }),
  ];
  const asked: string[][] = [];
  const port = withRunProgress(
    agentsPort([], runs),
    {
      summaries: (seen) => {
        asked.push(seen.map((r) => r.id));
        return seen.map((r) => ({ runId: r.id, step: null, report: { toCheck: 2, undeclared: 1 } }));
      },
    },
    () => now,
  );
  const state = handleAgentRequest(port, { method: "getAgents" }, questionsStub([]));
  expect(asked).toEqual([["live", "recent"]]);
  expect(state).toMatchObject({
    progress: [
      { runId: "live", report: { toCheck: 2 } },
      { runId: "recent", report: { toCheck: 2 } },
    ],
  });
  expect(port.state().runs).toBe(runs);
});

test("the agents state carries the open signal counts of each project", () => {
  const counts = [{ projectId: "p1", open: 3, unread: 2 }];
  const port = withSignalCounts(agentsPort([], []), { counts: () => counts });
  const state = handleAgentRequest(port, { method: "getAgents" }, questionsStub([]));
  expect(state).toMatchObject({ signals: counts });
  expect(port.state().signals).toEqual(counts);
});

test("without ticket execution a ticket run is never answered", () => {
  const calls: string[] = [];
  const waiting = runView({ id: "r1", state: "waiting_input" });
  const port = agentsPort(calls, [waiting]);
  const questions = questionsStub(calls, [answered("q1")], answered("q1", { blocking: true }));
  expect(() =>
    handleAgentRequest(port, { method: "answerRun", runId: "r1", text: "443" }, questions),
  ).toThrow("AGENT_EXECUTION_REMOVED");
  expect(calls).toEqual([]);
});

test("without ticket execution a waiting project run is still answered", () => {
  const calls: string[] = [];
  const project = runView({ id: "pa1", state: "waiting_input", kind: "project", ticketId: null });
  const port = agentsPort(calls, [project]);
  handleAgentRequest(port, { method: "answerRun", runId: "pa1", text: "oui" }, questionsStub(calls));
  expect(calls).toEqual(["drawer:p1:pa1:oui:human:adam", "answer:pa1:oui"]);
});
