import { expect, test } from "bun:test";
import type { MachineLock } from "@kibo/schema";
import { cleanHarness, setup, waitUntil } from "./orchestrator.test-helper";

cleanHarness();

const heavy = (held: number): MachineLock => ({
  name: "heavy",
  max: 2,
  held: Array.from({ length: held }, (_, i) => ({
    ticket: `t${i}`,
    label: "emis:EMIS-15 gates",
    pid: 100 + i,
    since: 0,
    cwd: "/w",
    alive: true,
  })),
  waiting: [],
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("the machine locks read at each queue pass reach the state, one change per new reading", async () => {
  let locks = [heavy(1)];
  const h = setup({ scenario: "done", locks: () => locks });
  expect(h.orch.state().locks).toEqual([heavy(1)]);
  let changes = 0;
  h.orch.onChange(() => changes++);
  await pause(350);
  changes = 0;
  await pause(350);
  expect(changes).toBe(0);
  locks = [heavy(2)];
  await waitUntil(() => changes > 0);
  expect(h.orch.state().locks).toEqual([heavy(2)]);
  await pause(350);
  expect(changes).toBe(1);
});

test("without a locks reader the state has no lock", () => {
  const h = setup({ scenario: "done" });
  expect(h.orch.state().locks).toEqual([]);
});
