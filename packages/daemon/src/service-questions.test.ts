import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentsState,
  type AnswerInput,
  answerPrompt,
  type ChangeMessage,
  Question,
  type RunView,
  Ticket,
} from "@kibo/schema";
import type { AgentsPort } from "./agents-rpc";
import { runView } from "./questions/questions.test-helper";
import { call, createService } from "./service";
import { openStore } from "./store";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ask = { context: "", options: ["Oui", "Non"], provisional: "Non" };

function fakeAgents(runs: RunView[], answers: [string, string][]): AgentsPort {
  const unused = () => {
    throw new Error("not used");
  };
  const state = (): AgentsState => ({
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
  });
  return {
    assign: unused,
    preview: unused,
    cancel: unused,
    move: unused,
    setPriority: unused,
    setHost: unused,
    log: unused,
    activeRuns: () => 0,
    onChange: () => () => {},
    onRunState: () => () => {},
    state,
    answer(runId, text) {
      answers.push([runId, text]);
      return runs.find((r) => r.id === runId) ?? runView({ id: runId });
    },
  };
}

function setup(runState: RunView["state"]) {
  const dir = mkdtempSync(join(tmpdir(), "kibo-service-q-"));
  dirs.push(dir);
  const s = createService(openStore(dir), { user: "adam" });
  const project = call(s, {
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  });
  const ticket = Ticket.parse(
    call(s, {
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title: "Stockage", statusId: "todo" },
    }),
  );
  const run = runView({ id: "r1", projectId: project.id, ticketId: ticket.id, state: runState });
  const answers: [string, string][] = [];
  s.attachAgents(fakeAgents([run], answers));
  const messages: ChangeMessage[] = [];
  s.onChange((m) => messages.push(m));
  const agentQuestion = (title: string, blocking: boolean) =>
    s.agentData.createQuestion(project.id, ticket.id, run, {
      ...ask,
      title,
      blocking,
      provisional: blocking ? null : "Non",
    });
  let at = 0;
  const answer = (questionId: string, choice: AnswerInput = { kind: "confirm" }) => {
    at += 1;
    const command = {
      method: "answerQuestion",
      questionId,
      answer: choice,
      by: { kind: "agent", ref: "x" },
      at,
    } as const;
    return Question.parse(call(s, { method: "command", projectId: project.id, command }));
  };
  const snapshot = () => call(s, { method: "getProject", projectId: project.id });
  return { s, project, ticket, answers, messages, agentQuestion, answer, snapshot };
}

test("a component or a user writes questions as the viewer, whatever it announces", () => {
  const { s, project, ticket } = setup("done");
  const created = Question.parse(
    call(s, {
      method: "command",
      projectId: project.id,
      command: {
        method: "createQuestion",
        ticketId: ticket.id,
        title: "Bloquer le dépôt ?",
        createdBy: { kind: "agent", ref: "emis-livraison" },
      },
    }),
  );
  expect(created.createdBy).toEqual({ kind: "human", ref: "adam" });
});

test("answering a question to validate of a finished run sends nothing and leaves it to deliver", () => {
  const { s, answers, agentQuestion, answer, messages } = setup("done");
  const q = agentQuestion("Bloquer le dépôt ?", false);
  expect(messages).toContainEqual({ topic: "agents" });
  const answered = answer(q?.id ?? "");
  expect(answered.answer).toMatchObject({
    kind: "confirm",
    by: { kind: "human", ref: "adam" },
    deliveredAt: null,
  });
  expect(answers).toEqual([]);
  expect(call(s, { method: "getAgents" }).questions).toEqual([
    { runId: "r1", open: 0, undelivered: 1, latestTitle: null },
  ]);
});

test("answering the blocking question of a waiting run resumes it at once and marks the answer", () => {
  const { answers, agentQuestion, answer, snapshot } = setup("waiting_input");
  const q = agentQuestion("Quel port ?", true);
  const answered = answer(q?.id ?? "", { kind: "option", option: "Oui" });
  expect(answers).toEqual([["r1", answerPrompt(answered)]]);
  expect(snapshot().questions[0]?.answer).toMatchObject({ deliveredRunId: "r1" });
});

test("delivering the answers of a ticket sends one message to its session and marks them", () => {
  const { s, project, ticket, answers, agentQuestion, answer, snapshot } = setup("done");
  const first = answer(agentQuestion("Bloquer le dépôt ?", false)?.id ?? "");
  const second = answer(agentQuestion("Garder les archives ?", false)?.id ?? "");
  expect(call(s, { method: "deliverAnswers", projectId: project.id, ticketId: ticket.id })).toEqual({
    sent: 2,
    runId: "r1",
  });
  expect(answers).toEqual([["r1", `${answerPrompt(first)}\n${answerPrompt(second)}`]]);
  expect(snapshot().questions.every((q) => q.answer?.deliveredRunId === "r1")).toBe(true);
  expect(s.deliverAnswers(project.id, ticket.id)).toEqual({ sent: 0, runId: null });
});
