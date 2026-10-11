import { afterEach, beforeEach, expect, test } from "bun:test";
import type { ActionResult, Batch } from "@kibo/schema";
import { type Kit, PROJECT_ID, serviceKit } from "./service.test-helper";

let kit: Kit;
beforeEach(() => {
  kit = serviceKit();
});
afterEach(() => kit.cleanup());

async function pendingWithSignals(): Promise<Batch> {
  kit.signals.add(1, { projectId: PROJECT_ID });
  kit.signals.add(2, { projectId: PROJECT_ID, kind: "context" });
  const run = kit.svc.send(PROJECT_ID, "Réveil automatique : 1 signal à traiter (1 ticket à créer).");
  await kit.svc.turns.prepare(run, kit.dir);
  kit.svc.propose(run, {
    summary: "Traiter les signaux",
    actions: [
      { id: 1, why: "signalé", type: "createTicket", ref: "new:1", title: "Tests", signals: ["sig:1"] },
      { id: 2, why: "rien à faire", type: "dismissSignal", signal: "sig:2" },
    ],
  });
  const pending = kit.store.pendingBatch(PROJECT_ID);
  if (!pending) throw new Error("no pending batch");
  return pending;
}

function watchSettle(): { seen: { results: readonly ActionResult[]; recorded: number }[] } {
  const settle = kit.signals.settle;
  const seen: { results: readonly ActionResult[]; recorded: number }[] = [];
  kit.signals.settle = (batch, results, by) => {
    seen.push({ results, recorded: kit.store.batch(batch.id)?.results.length ?? 0 });
    settle(batch, results, by);
  };
  return { seen };
}

test("apply settles the cited signals with the real results once they are recorded", async () => {
  const pending = await pendingWithSignals();
  const { seen } = watchSettle();
  const decided = await kit.svc.decide({ projectId: PROJECT_ID, batchId: pending.id, decision: "apply" });
  expect(seen).toEqual([{ results: decided.results, recorded: 2 }]);
  expect(kit.signals.all().map((s) => [s.ref, s.status, s.batchId, s.actionId])).toEqual([
    ["sig:1", "handled", pending.id, 1],
    ["sig:2", "ignored", pending.id, 2],
  ]);
  expect(kit.signals.all()[1]?.decidedBy).toEqual({ kind: "human", ref: "adam" });
});

test("an unchecked or failed action leaves its signal open", async () => {
  const pending = await pendingWithSignals();
  kit.setApply(async () => {
    throw new Error("disk gone");
  });
  await kit.svc.decide({ projectId: PROJECT_ID, batchId: pending.id, decision: "apply", actionIds: [1] });
  expect(kit.signals.all().map((s) => s.status)).toEqual(["read", "read"]);
});

test("a rejected batch never settles its signals", async () => {
  const pending = await pendingWithSignals();
  const { seen } = watchSettle();
  await kit.svc.decide({ projectId: PROJECT_ID, batchId: pending.id, decision: "reject", comment: "non" });
  expect(seen).toEqual([]);
  expect(kit.signals.all().map((s) => s.status)).toEqual(["read", "read"]);
});
