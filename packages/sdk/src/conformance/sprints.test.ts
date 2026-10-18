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
  expect(await mock.sdk.sprints.list()).toEqual(mock.snapshot().sprints);
  expect(mock.used).toContain("read:sprint");
  expect(mock.violations).toEqual([]);
});

test("a component that does not write sprints is refused on create, and the violation is recorded", async () => {
  const mock = createMockSdk(manifest(["ticket"]));
  await expect(
    mock.sdk.sprints.create({ code: "S44", name: "Rapports", start: "2026-10-26", end: "2026-10-30" }),
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

test("the mock plans a feature on assign, and its sprint view counts it", async () => {
  const mock = createMockSdk(manifest(["ticket", "sprint"]), { today: "2026-10-14" });
  const s42 = await mock.sdk.sprints.create({
    code: "S42",
    name: "Saisie hors ligne",
    start: "2026-10-12",
    end: "2026-10-16",
  });
  const f5 = await mock.sdk.run({ method: "createTicket", title: "Photos" });
  const step = await mock.sdk.run({ method: "createTicket", title: "Envoi", parentId: f5.id });
  await mock.sdk.sprints.assign(f5.id, s42.id);
  expect(await mock.sdk.sprints.list()).toEqual([
    { ...s42, state: "current", features: [f5.id], delivered: 0, total: 1, lingering: false },
  ]);
  const tickets = await mock.sdk.list("ticket");
  expect(tickets.find((t) => t.id === step.id)?.effectiveSprintId).toBe(s42.id);
  await mock.sdk.sprints.assign(f5.id, null);
  expect((await mock.sdk.sprints.list())[0]?.features).toEqual([]);
  expect(mock.violations).toEqual([]);
});

test("the mock refuses a sprint code already taken in the project, case ignored", async () => {
  const mock = createMockSdk(manifest(["sprint"]));
  await mock.sdk.sprints.create({
    code: "S42",
    name: "Saisie hors ligne",
    start: "2026-10-12",
    end: "2026-10-16",
  });
  await expect(
    mock.sdk.sprints.create({ code: "s42", name: "Autre", start: "2026-10-19", end: "2026-10-23" }),
  ).rejects.toThrow("CONFLICT");
  expect(mock.violations).toEqual([]);
});
