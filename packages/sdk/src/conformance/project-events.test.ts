import { expect, test } from "bun:test";
import type { ProjectEvent } from "@kibo/schema";
import { createMockSdk } from "../mock";

const EVENT: ProjectEvent = {
  id: 1,
  projectId: "mock",
  at: 1_760_000_000_000,
  kind: "pr_opened",
  ticketId: null,
  featureId: null,
  source: "git",
  data: { number: 22 },
};
const manifest = (reads: ("ticket" | "project_event")[]) => ({
  id: "journal",
  version: "1.0.0",
  kind: "view" as const,
  title: "Journal",
  reads,
  writes: [],
});

test("a component that reads the journal lists its events", async () => {
  const mock = createMockSdk(manifest(["project_event"]), { events: [EVENT] });
  expect(await mock.sdk.list("project_event")).toEqual([EVENT]);
  expect(mock.used).toContain("read:project_event");
  expect(mock.violations).toEqual([]);
});

test("reading the journal without declaring it is refused and recorded", async () => {
  const mock = createMockSdk(manifest(["ticket"]), { events: [EVENT] });
  await expect(mock.sdk.list("project_event")).rejects.toThrow("PERMISSION_DENIED");
  expect(mock.violations).toEqual(["read project_event"]);
});

test("no component may declare to write the journal", () => {
  expect(() => createMockSdk({ ...manifest(["project_event"]), writes: ["project_event"] })).toThrow();
});
