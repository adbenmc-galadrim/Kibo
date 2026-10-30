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

test("a component reads the project tracking", async () => {
  const mock = createMockSdk(manifest(["ticket"]));
  expect(await mock.sdk.settings.get()).toEqual({ tracking: null });
  expect(mock.used).toContain("read:ticket");
  const planned = createMockSdk(manifest(["ticket"]), { tracking: { openLimit: 3 } });
  expect(await planned.sdk.settings.get()).toEqual({ tracking: { openLimit: 3 } });
});

test("reading the settings needs read:ticket, and the violation is recorded", async () => {
  const mock = createMockSdk(manifest(["status"]));
  await expect(mock.sdk.settings.get()).rejects.toThrow("PERMISSION_DENIED");
  expect(mock.violations).toEqual(["read settings"]);
});

test("the host notifies a change of the project tracking", async () => {
  const mock = createMockSdk(manifest(["ticket"]));
  let calls = 0;
  const off = mock.sdk.settings.subscribe(() => {
    calls += 1;
  });
  mock.setTracking({ openLimit: 4 });
  expect(calls).toBe(1);
  expect(await mock.sdk.settings.get()).toEqual({ tracking: { openLimit: 4 } });
  off();
  mock.setTracking({ openLimit: 5 });
  expect(calls).toBe(1);
});
