import { afterEach, expect, test } from "bun:test";
import type { ProjectMeta, Question, SignalsView } from "@kibo/schema";
import {
  agentsOf,
  type Rpc,
  seedKibo,
  startStack,
  stopDaemons,
  turnDone,
  viewOf,
  waitFor,
} from "./integration.test-helper";

afterEach(stopDaemons);

const ADAM = { kind: "human", ref: "adam" } as const;
const IMPORT = { kind: "import", ref: "csv" } as const;

function questionsOf(rpc: Rpc, projectId: string) {
  const command = <T>(cmd: Record<string, unknown>) => rpc<T>({ method: "command", projectId, command: cmd });
  return {
    ask: (ticketId: string, title: string) =>
      command<Question>({ method: "createQuestion", ticketId, title, createdBy: ADAM, runId: null }),
    answer: (q: Question, text: string, by: typeof ADAM | typeof IMPORT = ADAM) =>
      command({ method: "answerQuestion", questionId: q.id, answer: { kind: "text", text }, by }),
  };
}

const openRun = (rpc: Rpc, projectId: string) =>
  waitFor(async () => (await viewOf(rpc, projectId)).run ?? undefined);

test("an answer wakes the project agent once, a second one waits for the window", async () => {
  const stack = await startStack("project-agent-answer", undefined, { answerWakeGraceMs: 0 });
  const { project, receiver, docs } = await seedKibo(stack.rpc);
  const questions = questionsOf(stack.rpc, project.id);
  const quota = await questions.ask(receiver.id, "Quota par client ?");
  const format = await questions.ask(docs.id, "Format du guide ?");
  await questions.answer(quota, "5 Go");

  const run = await openRun(stack.rpc, project.id);
  await turnDone(stack.rpc, run.id, 1);
  const prompt = stack.calls(run.sessionId)[0]?.prompt ?? "";
  expect(prompt).toContain("Réveil automatique : 1 réponse à lire.");
  expect(prompt).toContain("- Q1 répondue : « 5 Go »");
  expect((await viewOf(stack.rpc, project.id)).batches.map((b) => b.status)).toEqual(["pending"]);

  await questions.answer(format, "Markdown");
  const signals = await stack.rpc<SignalsView>({ method: "listSignals", projectId: project.id });
  expect(signals.wakeup.dueAt).not.toBeNull();
  await Bun.sleep(2_000);
  const runs = (await agentsOf(stack.rpc)).runs.filter((r) => r.projectId === project.id);
  expect(runs.map((r) => [r.id, r.turns])).toEqual([[run.id, 1]]);
}, 60_000);

test("an imported answer never wakes the project agent", async () => {
  const stack = await startStack("project-agent-answer", undefined, { answerWakeGraceMs: 0 });
  const project = await stack.rpc<ProjectMeta>({
    method: "createProject",
    name: "Silo",
    key: "SILO",
    folder: null,
    color: "#14B8A6",
  });
  const ticket = await stack.rpc<{ id: string }>({
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: "Quota", statusId: "todo" },
  });
  const questions = questionsOf(stack.rpc, project.id);
  await questions.answer(await questions.ask(ticket.id, "Quota par client ?"), "5 Go", IMPORT);
  await Bun.sleep(1_000);
  expect((await viewOf(stack.rpc, project.id)).run).toBeNull();
}, 60_000);
