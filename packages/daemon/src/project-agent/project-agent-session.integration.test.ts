import { expect, test } from "bun:test";
import {
  agentsOf,
  decide,
  logOf,
  postMcp,
  runToken,
  seedKibo,
  send,
  snapshotOf,
  startStack,
  turnDone,
  viewOf,
  waitFor,
} from "./integration.test-helper";

const COMMENT = "Pas cette semaine";

test("a rejection with a comment costs one turn; Nouvel agent abandons the pending batch, keeps the memory and starts a fresh session", async () => {
  const stack = await startStack();
  const { project, receiver } = await seedKibo(stack.rpc);
  const run = await send(stack.rpc, project.id, "Où en est-on ?");
  await turnDone(stack.rpc, run.id, 1);
  const [first] = (await viewOf(stack.rpc, project.id)).batches;
  const applied = await decide(stack.rpc, {
    projectId: project.id,
    batchId: first?.id,
    decision: "apply",
    actionIds: [4, 5],
  });
  expect(applied.results.map((r) => r.outcome)).toEqual([
    "skipped",
    "skipped",
    "skipped",
    "applied",
    "applied",
  ]);
  const [question] = (await snapshotOf(stack.rpc, project.id)).questions;
  expect(question).toMatchObject({
    ticketId: receiver.id,
    title: "Faut-il la doc ?",
    createdBy: { kind: "human", ref: "adam" },
    runId: null,
  });

  await send(stack.rpc, project.id, "Propose un lot invalide");
  await turnDone(stack.rpc, run.id, 2);
  const second = (await viewOf(stack.rpc, project.id)).batches.find((b) => b.seq === 2);
  const rejected = await decide(stack.rpc, {
    projectId: project.id,
    batchId: second?.id,
    decision: "reject",
    comment: COMMENT,
  });
  expect(rejected).toMatchObject({ status: "rejected", comment: COMMENT, results: [] });
  await turnDone(stack.rpc, run.id, 3);
  expect(stack.calls(run.sessionId)[2]?.prompt).toContain(`Lot 2 refusé : ${COMMENT}`);
  const exits = (await logOf(stack.rpc, run.id)).flatMap((e) => (e.event.type === "exited" ? [e.event] : []));
  expect(exits.at(-1)).toMatchObject({ result: "Compris, je retire la proposition." });
  expect(stack.calls(run.sessionId)).toHaveLength(3);

  await send(stack.rpc, project.id, "Encore un lot invalide");
  await turnDone(stack.rpc, run.id, 4);
  const reset = await stack.rpc<{ session: unknown; past: { runId: string }[] }>({
    method: "resetProjectAgent",
    projectId: project.id,
  });
  expect(reset.session).toBeNull();
  expect(reset.past.map((s) => s.runId)).toEqual([run.id]);
  const old = await viewOf(stack.rpc, project.id, run.id);
  expect(old.batches.map((b) => [b.seq, b.status])).toEqual([
    [1, "partial"],
    [2, "rejected"],
    [3, "abandoned"],
  ]);

  const next = await send(stack.rpc, project.id, "Reprenons");
  expect(next.id).not.toBe(run.id);
  expect(next.sessionId).not.toBe(run.sessionId);
  await turnDone(stack.rpc, next.id, 1);
  const [fresh] = stack.calls(next.sessionId);
  expect(fresh?.argv).toContain("--session-id");
  expect(fresh?.prompt).toContain("# Projet");
  expect(fresh?.prompt).toContain("KIB-1 lancé");
  const view = await viewOf(stack.rpc, project.id);
  expect(view.session?.runId).toBe(next.id);
  expect(view.past.map((s) => s.runId)).toEqual([run.id]);
  expect(view.batches.map((b) => [b.seq, b.status])).toEqual([[4, "pending"]]);
}, 120_000);

test("the MCP route answers only the live turn of a project run", async () => {
  const stack = await startStack();
  const { project, docs, opus } = await seedKibo(stack.rpc);
  const run = await send(stack.rpc, project.id, "Où en est-on ?");
  await turnDone(stack.rpc, run.id, 1);
  const token = runToken(stack.home, run.id);
  expect((await postMcp(stack.url, run.id, null)).status).toBe(401);
  expect((await postMcp(stack.url, run.id, token)).status).toBe(401);
  const ticketRun = await stack.rpc<{ id: string }>({
    method: "assignAgent",
    projectId: project.id,
    ticketId: docs.id,
    profileId: opus.id,
    brief: "Écrire le guide",
  });
  expect((await postMcp(stack.url, ticketRun.id, token)).status).toBe(401);
  expect((await postMcp(stack.url, "not-a-run", token)).status).toBe(404);
  await waitFor(async () =>
    (await agentsOf(stack.rpc)).runs.find((r) => r.id === ticketRun.id && r.state === "done"),
  );
}, 60_000);

test("a daemon restart keeps the session and runs the queued message", async () => {
  const stack = await startStack();
  const { project } = await seedKibo(stack.rpc);
  await stack.rpc({ method: "setHost", patch: { paused: true } });
  const run = await send(stack.rpc, project.id, "Où en est-on après le redémarrage ?");
  expect(run.state).toBe("queued");
  await stack.restart();
  const kept = await viewOf(stack.rpc, project.id);
  expect(kept.session?.runId).toBe(run.id);
  expect(kept.run).toMatchObject({ id: run.id, state: "queued" });
  await stack.rpc({ method: "setHost", patch: { paused: false } });
  await turnDone(stack.rpc, run.id, 1);
  expect(stack.calls(run.sessionId)[0]?.prompt).toContain("Où en est-on après le redémarrage ?");
  expect((await viewOf(stack.rpc, project.id)).batches.map((b) => b.status)).toEqual(["pending"]);
}, 90_000);
