import { expect, test } from "bun:test";
import { createMockSdk } from "../mock";

const manifest = (reads: ("ticket" | "status")[]) => ({
  id: "planner",
  version: "1.0.0",
  kind: "view" as const,
  title: "Planner",
  reads,
  writes: [],
});

test("a component reads the project tracking and the agent execution, hidden by default", async () => {
  const mock = createMockSdk(manifest(["ticket"]));
  expect(await mock.sdk.settings.get()).toEqual({ tracking: null, agentExecution: "hidden" });
  expect(mock.used).toContain("read:ticket");
  const planned = createMockSdk(manifest(["ticket"]), {
    tracking: { openLimit: 3 },
    agentExecution: "shown",
  });
  expect(await planned.sdk.settings.get()).toEqual({ tracking: { openLimit: 3 }, agentExecution: "shown" });
});

test("reading the settings needs read:ticket, and the violation is recorded", async () => {
  const mock = createMockSdk(manifest(["status"]));
  await expect(mock.sdk.settings.get()).rejects.toThrow("PERMISSION_DENIED");
  expect(mock.violations).toEqual(["read settings"]);
});

test("the host notifies a change of the project tracking or of the machine setting", async () => {
  const mock = createMockSdk(manifest(["ticket"]));
  let calls = 0;
  const off = mock.sdk.settings.subscribe(() => {
    calls += 1;
  });
  mock.setTracking({ openLimit: 4 });
  mock.setAgentExecution("shown");
  expect(calls).toBe(2);
  expect(await mock.sdk.settings.get()).toEqual({ tracking: { openLimit: 4 }, agentExecution: "shown" });
  off();
  mock.setAgentExecution("hidden");
  expect(calls).toBe(2);
});
