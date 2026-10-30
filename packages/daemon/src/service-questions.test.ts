import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentsState,
  type AnswerInput,
  type ChangeMessage,
  type ProjectCommand,
  Question,
  type RunView,
  Ticket,
} from "@kibo/schema";
import { runView } from "./questions/questions.test-helper";
import type { AgentsPort } from "./runs/rpc";
import { call, createService } from "./service";
import { openStore } from "./store";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ask = {
  context: "",
  options: ["Oui", "Non"],
  provisional: "Non",
  recipient: null,
  kind: "question" as const,
  images: [],
};

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
    projectAgents: [],
  });
  return {
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
    name: "Silo",
    key: "SILO",
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
  const runs = [run];
  s.attachAgents(fakeAgents(runs, answers));
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
  return { s, project, ticket, run, runs, answers, messages, agentQuestion, answer, snapshot };
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
        createdBy: { kind: "agent", ref: "silo-livraison" },
      },
    }),
  );
  expect(created.createdBy).toEqual({ kind: "human", ref: "adam" });
});

test("answering a question to validate of a finished run sends nothing and leaves it to deliver", () => {
  const { answers, agentQuestion, answer, messages } = setup("done");
  const q = agentQuestion("Bloquer le dépôt ?", false);
  expect(messages).toContainEqual({ topic: "agents" });
  const answered = answer(q?.id ?? "");
  expect(answered.answer).toMatchObject({
    kind: "confirm",
    by: { kind: "human", ref: "adam" },
    deliveredAt: null,
  });
  expect(answers).toEqual([]);
});

test("answering the blocking question of a waiting run resumes nothing and leaves the answer unmarked", () => {
  const { answers, agentQuestion, answer, snapshot } = setup("waiting_input");
  const q = agentQuestion("Quel port ?", true);
  const answered = answer(q?.id ?? "", { kind: "option", option: "Oui" });
  expect(answered.answer).toMatchObject({ kind: "option", option: "Oui", deliveredAt: null });
  expect(answers).toEqual([]);
  expect(snapshot().questions[0]?.answer).toMatchObject({ deliveredAt: null, deliveredRunId: null });
});

test("the agents state still answers when a run belongs to a removed project", () => {
  const { s, run, runs } = setup("done");
  runs.push({ ...run, id: "r9", seq: 9, projectId: "removed", ticketId: "t9" });
  expect(call(s, { method: "getAgents" }).runs.map((r) => r.id)).toEqual(["r1", "r9"]);
});

test("recipient commands update the snapshot and announce the project", () => {
  const { s, project, agentQuestion, messages, snapshot } = setup("done");
  const command = (cmd: ProjectCommand) =>
    call(s, { method: "command", projectId: project.id, command: cmd });
  command({ method: "addQuestionRecipient", name: "Juridique" });
  expect(snapshot().questionRecipients.map((r) => r.name)).toEqual([
    "Moi (technique)",
    "Produit",
    "Client",
    "Juridique",
  ]);
  const q = agentQuestion("Quel tarif ?", false);
  messages.length = 0;
  command({ method: "setQuestionRecipient", questionId: q?.id ?? "", recipient: "client" });
  command({ method: "markQuestionSent", questionId: q?.id ?? "", at: 42 });
  expect(snapshot().questions[0]).toMatchObject({ recipient: "client", sentAt: 42 });
  expect(messages).toContainEqual({ projectId: project.id });
  expect(() => command({ method: "removeQuestionRecipient", recipientId: "client" })).toThrow(
    expect.objectContaining({ code: "CONFLICT" }),
  );
});
