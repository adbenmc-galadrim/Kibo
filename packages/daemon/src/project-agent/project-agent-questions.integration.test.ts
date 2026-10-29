import { afterEach, expect, test } from "bun:test";
import type { ProjectSnapshot, Question } from "@kibo/schema";
import {
  decide,
  type Rpc,
  type Seeded,
  seedKibo,
  send,
  snapshotOf,
  startStack,
  stopDaemons,
  turnDone,
  viewOf,
} from "./integration.test-helper";

afterEach(stopDaemons);

const ADAM = { kind: "human", ref: "adam" } as const;

async function seedQuestions(rpc: Rpc, seeded: Seeded): Promise<void> {
  const { project, receiver, docs } = seeded;
  const command = <T>(cmd: Record<string, unknown>) =>
    rpc<T>({ method: "command", projectId: project.id, command: cmd });
  const ask = (ticketId: string, title: string) =>
    command<Question>({ method: "createQuestion", ticketId, title, createdBy: ADAM, runId: null });
  const answer = (q: Question) =>
    command({ method: "answerQuestion", questionId: q.id, answer: { kind: "text", text: "Oui" }, by: ADAM });
  await ask(receiver.id, "Client - Couleur ?");
  await answer(await ask(receiver.id, "Client - Police ?"));
  await command({
    method: "archiveQuestion",
    questionId: (await ask(receiver.id, "Client - Doublon ?")).id,
    by: ADAM,
  });
  await answer(await ask(docs.id, "Client - Logo ?"));
}

const byTitle = (snapshot: ProjectSnapshot, title: string) =>
  snapshot.questions.find((q) => q.title === title);

test("a question batch adds a recipient, asks, renames, reopens and archives, then the digest tells it", async () => {
  const stack = await startStack();
  const seeded = await seedKibo(stack.rpc);
  const { project } = seeded;
  await seedQuestions(stack.rpc, seeded);

  const started = await send(stack.rpc, project.id, "Peux-tu ranger les questions ?");
  await turnDone(stack.rpc, started.id, 1);
  const [first] = stack.calls(started.sessionId);
  expect(first?.mcp.map((c) => [c.tool, c.isError])).toEqual([
    ["list_questions", false],
    ["project_overview", false],
    ["propose_batch", false],
  ]);
  expect(JSON.parse(first?.mcp[1]?.text ?? "{}").recipients).toHaveLength(3);
  const [batch] = (await viewOf(stack.rpc, project.id)).batches;
  expect(batch).toMatchObject({ status: "pending", summary: "Ranger les questions du client" });
  expect(batch?.actions.map((a) => a.type)).toEqual([
    "addRecipient",
    "createQuestion",
    "createQuestion",
    "updateQuestion",
    "reopenQuestion",
    "deleteQuestion",
  ]);

  const decided = await decide(stack.rpc, { projectId: project.id, batchId: batch?.id, decision: "apply" });
  expect(decided.results.map((r) => r.outcome)).toEqual(Array(6).fill("applied"));
  const snapshot = await snapshotOf(stack.rpc, project.id);
  const galadrim = snapshot.questionRecipients.find((r) => r.name === "Galadrim");
  expect(galadrim).toBeDefined();
  expect(byTitle(snapshot, "Quel hébergeur ?")?.recipient).toBe(galadrim?.id ?? "");
  expect(byTitle(snapshot, "Quelle licence ?")?.recipient).toBe("client");
  const renamed = byTitle(snapshot, "Couleur ?");
  expect(renamed).toMatchObject({ recipient: galadrim?.id ?? "" });
  expect(renamed?.history[0]?.kind).toBe("updated");
  expect(byTitle(snapshot, "Client - Logo ?")?.answer).toBeNull();
  expect(byTitle(snapshot, "Client - Police ?")?.archivedAt).not.toBeNull();

  await send(stack.rpc, project.id, "Bilan : ranger les questions, c'est fait ?");
  await turnDone(stack.rpc, started.id, 2);
  const second = stack.calls(started.sessionId)[1];
  const [changes, listed] = second?.mcp ?? [];
  expect(changes?.text).toContain(
    "Question modifiée : Couleur ? (titre : « Client - Couleur ? » → « Couleur ? »)",
  );
  expect(changes?.text).toContain("Destinataire de « Couleur ? » : Moi (technique) → Galadrim");
  expect(changes?.text).toContain("Question rouverte : Client - Logo ?");
  expect(changes?.text).toContain("Question archivée : Client - Police ?");
  expect(listed?.text).not.toContain("Client - Police ?");
  expect(listed?.text).toContain("Client - Logo ?");
}, 90_000);

test("an answered question no longer blocks an update, the batch is proposed at once", async () => {
  const stack = await startStack();
  const seeded = await seedKibo(stack.rpc);
  const { project } = seeded;
  await seedQuestions(stack.rpc, seeded);

  const run = await send(stack.rpc, project.id, "Renomme la question transmise");
  await turnDone(stack.rpc, run.id, 1);
  const [call] = stack.calls(run.sessionId);
  expect(call?.mcp.map((c) => [c.tool, c.isError])).toEqual([
    ["list_questions", false],
    ["propose_batch", false],
    ["propose_batch", false],
  ]);
  expect(call?.mcp[0]?.text).not.toContain("delivered");
  const batches = (await viewOf(stack.rpc, project.id)).batches;
  expect(batches.map((b) => b.status).sort()).toEqual(["pending", "superseded"]);
  const superseded = batches.find((b) => b.status === "superseded");
  expect(superseded?.actions.map((a) => a.type)).toEqual(["updateQuestion"]);
  const pending = batches.find((b) => b.status === "pending");
  expect(pending?.actions.map((a) => a.type)).toEqual(["reopenQuestion", "updateQuestion"]);
  const decided = await decide(stack.rpc, { projectId: project.id, batchId: pending?.id, decision: "apply" });
  expect(decided.results.map((r) => r.outcome)).toEqual(["applied", "applied"]);
  const logo = byTitle(await snapshotOf(stack.rpc, project.id), "Logo ?");
  expect(logo?.answer).toBeNull();
  expect(logo?.history.map((e) => e.kind)).toEqual(["reopened", "updated"]);
}, 90_000);
