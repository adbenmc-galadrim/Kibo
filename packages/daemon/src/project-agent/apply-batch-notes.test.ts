import { afterEach, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { applyBatch } from "./apply-batch";
import { type Harness, HUMAN, harness, propose } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

test("a note is applied without calling the agents port once the context is read", async () => {
  const h = harness();
  open.push(h);
  const batch = await propose(h, [{ id: 1, why: "", type: "createNote", path: "a.md", content: "# A\n" }]);
  let calls = 0;
  const agents = () => {
    calls += 1;
    if (calls > 1) throw new KiboError("INTERNAL", "agents are not ready");
    return h.agents;
  };
  const results = await applyBatch(
    { data: h.data, agents, signals: h.signals },
    { ...batch, chosen: null },
    new Set([1]),
    HUMAN,
  );
  expect(results).toEqual([{ actionId: 1, outcome: "applied", detail: null, created: null }]);
  expect(calls).toBe(1);
  expect((await h.data.notes(h.project.id)).map((n) => n.path)).toEqual(["a.md"]);
});
