import { afterEach, beforeEach, expect, test } from "bun:test";
import { type Batch, undecidedActionIds } from "@kibo/schema";
import { type Kit, PROJECT_ID, serviceKit } from "./service.test-helper";

let kit: Kit;
beforeEach(() => {
  kit = serviceKit();
});
afterEach(() => kit.cleanup());

async function threeActions(): Promise<Batch> {
  const run = kit.svc.send(PROJECT_ID, "Fin de sprint");
  await kit.svc.turns.prepare(run, kit.dir);
  kit.svc.propose(run, {
    summary: "Fin de sprint",
    actions: [
      { id: 1, why: "livré", type: "setStatus", ticket: "SILO-11", statusId: "done" },
      { id: 2, why: "commencer", type: "setStatus", ticket: "SILO-1", statusId: "in_progress" },
      { id: 3, why: "attend", type: "link", from: "SILO-11", to: "SILO-1", kind: "blocks" },
    ],
  });
  const pending = kit.store.pendingBatch(PROJECT_ID);
  if (!pending) throw new Error("no pending batch");
  return pending;
}

const decide = (batch: Batch, input: Partial<Parameters<Kit["svc"]["decide"]>[0]>) =>
  kit.svc.decide({ projectId: PROJECT_ID, batchId: batch.id, decision: "apply", ...input });

test("keepRest applies the given actions only and leaves the rest to decide", async () => {
  const batch = await threeActions();
  const after = await decide(batch, { actionIds: [1], keepRest: true });
  expect(kit.calls).toContain("apply:1:adam");
  expect(after.status).toBe("pending");
  expect(after.results).toEqual([{ actionId: 1, outcome: "applied", detail: null, created: null }]);
  expect(undecidedActionIds(after)).toEqual([2, 3]);
  expect(kit.store.pendingBatch(PROJECT_ID)?.id).toBe(batch.id);
});

test("a decided action cannot be decided again, the undecided ones still can", async () => {
  const batch = await threeActions();
  await decide(batch, { actionIds: [1], keepRest: true });
  await expect(decide(batch, { actionIds: [1, 2] })).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(decide(batch, { actionIds: [1], keepRest: true })).rejects.toMatchObject({
    code: "CONFLICT",
  });
  const closed = await decide(batch, { actionIds: [3] });
  expect(kit.calls).toContain("apply:3:adam");
  expect(closed.status).toBe("partial");
  expect(closed.results.map((r) => [r.actionId, r.outcome])).toEqual([
    [1, "applied"],
    [2, "skipped"],
    [3, "applied"],
  ]);
});

test("deciding the last undecided action with keepRest closes the batch on every result", async () => {
  const batch = await threeActions();
  await decide(batch, { actionIds: [2], keepRest: true });
  const closed = await decide(batch, { actionIds: [1, 3], keepRest: true });
  expect(closed.status).toBe("applied");
  expect(closed.results.map((r) => r.actionId)).toEqual([1, 2, 3]);
});

test("a keepRest reject skips its actions without a message to the agent", async () => {
  const batch = await threeActions();
  const after = await kit.svc.decide({
    projectId: PROJECT_ID,
    batchId: batch.id,
    decision: "reject",
    actionIds: [2],
    keepRest: true,
    comment: "non",
  });
  expect(after.status).toBe("pending");
  expect(after.results.map((r) => [r.actionId, r.outcome])).toEqual([[2, "skipped"]]);
  expect(kit.calls.filter((c) => c.startsWith("answer:"))).toEqual([]);
  expect(kit.calls.filter((c) => c.startsWith("apply:"))).toEqual([]);
});

test("a plain reject of a partly decided batch skips the rest and closes it partial", async () => {
  const batch = await threeActions();
  await decide(batch, { actionIds: [1], keepRest: true });
  const closed = await kit.svc.decide({ projectId: PROJECT_ID, batchId: batch.id, decision: "reject" });
  expect(closed.status).toBe("partial");
  expect(closed.results.map((r) => r.outcome)).toEqual(["applied", "skipped", "skipped"]);
});

test("keepRest needs the action ids", async () => {
  const batch = await threeActions();
  await expect(decide(batch, { keepRest: true })).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("a plain apply without ids applies only the undecided actions", async () => {
  const batch = await threeActions();
  await decide(batch, { actionIds: [2], keepRest: true });
  const closed = await decide(batch, {});
  expect(kit.calls).toContain("apply:1,3:adam");
  expect(closed.status).toBe("applied");
});

test("a partly decided batch replaced by a new proposal turns partial", async () => {
  const batch = await threeActions();
  await decide(batch, { actionIds: [1], keepRest: true });
  const run = kit.store.openSession(PROJECT_ID);
  if (!run) throw new Error("no session");
  const view = kit.svc.view(PROJECT_ID);
  if (!view.run) throw new Error("no run");
  kit.svc.propose(view.run, {
    summary: "Autre",
    actions: [{ id: 1, why: "", type: "setStatus", ticket: "SILO-1", statusId: "in_progress" }],
  });
  expect(kit.store.batch(batch.id)?.status).toBe("partial");
});
