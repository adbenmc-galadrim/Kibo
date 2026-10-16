import { expect, test } from "bun:test";
import { createMockSdk } from "../mock";

const manifest = (writes: ("ticket" | "sprint")[]) => ({
  id: "planner",
  version: "1.0.0",
  kind: "view" as const,
  title: "Planner",
  reads: ["ticket" as const, "sprint" as const],
  writes,
});

test("the mock lists the sprints of its project and records the read", async () => {
  const mock = createMockSdk(manifest(["ticket", "sprint"]));
  expect(await mock.sdk.sprints.list()).toEqual(mock.snapshot().sprints ?? []);
  expect(mock.used).toContain("read:sprint");
  expect(mock.violations).toEqual([]);
});

test("a component that does not write sprints is refused on create, and the violation is recorded", async () => {
  const mock = createMockSdk(manifest(["ticket"]));
  await expect(
    mock.sdk.sprints.create({ name: "Rapports", start: "2026-10-26", end: "2026-10-30" }),
  ).rejects.toThrow("PERMISSION_DENIED");
  expect(mock.used).toContain("write:sprint");
  expect(mock.violations).toEqual(["write createSprint"]);
});

test("assigning a sprint is a ticket write in the mock", async () => {
  const mock = createMockSdk(manifest(["sprint"]));
  await expect(mock.sdk.sprints.assign("f9", "s44")).rejects.toThrow("PERMISSION_DENIED");
  expect(mock.used).toContain("write:ticket");
  expect(mock.violations).toEqual(["write setTicketSprint"]);
});
