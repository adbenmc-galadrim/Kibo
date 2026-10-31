import { expect, test } from "bun:test";
import {
  ListProjectEventsInput,
  PROJECT_EVENTS_RETENTION,
  ProjectEvent,
  ProjectEventInput,
  ProjectEventKind,
  ProjectEventSource,
} from "./project-event";
import { RpcRequest } from "./rpc";
import { TRACKING_RPC_METHODS } from "./tracking-rpc";

const TICKET = "11111111-1111-4111-8111-111111111111";
const FEATURE = "22222222-2222-4222-8222-222222222222";

const merged = {
  kind: "pr_merged",
  ticketId: TICKET,
  featureId: FEATURE,
  source: "git",
  data: { number: 18, delivered: "F3" },
};

test("a project event parses with its id, project and time", () => {
  const event = ProjectEvent.parse({ ...merged, id: 1, projectId: "p1", at: 1_760_000_000_000 });
  expect(event).toMatchObject({ kind: "pr_merged", source: "git", data: { number: 18, delivered: "F3" } });
  expect(ProjectEventInput.parse({ ...merged, ticketId: null, featureId: null }).ticketId).toBeNull();
});

test("the kinds and sources of the journal are closed", () => {
  expect(ProjectEventKind.options).toHaveLength(22);
  expect(ProjectEventKind.options).toContain("keys_assigned");
  expect(ProjectEventKind.options).toContain("question_deleted");
  expect(ProjectEventSource.options).toEqual([
    "git",
    "full-delivery",
    "update-delivery",
    "project-agent",
    "user",
    "kibo",
  ]);
  expect(ProjectEventInput.safeParse({ ...merged, kind: "deleted" }).success).toBe(false);
  expect(ProjectEventInput.safeParse({ ...merged, source: "llm" }).success).toBe(false);
});

test("event data is bounded", () => {
  expect(ProjectEventInput.safeParse({ ...merged, data: { note: "x".repeat(300) } }).success).toBe(true);
  expect(ProjectEventInput.safeParse({ ...merged, data: { note: "x".repeat(301) } }).success).toBe(false);
  expect(ProjectEventInput.safeParse({ ...merged, data: { nested: { a: 1 } } }).success).toBe(false);
  expect(ProjectEventInput.safeParse({ ...merged, data: { ok: true, none: null } }).success).toBe(true);
});

test("listing events defaults to 50 and caps at 200", () => {
  expect(ListProjectEventsInput.parse({ projectId: "p1" }).limit).toBe(50);
  expect(ListProjectEventsInput.safeParse({ projectId: "p1", limit: 200 }).success).toBe(true);
  expect(ListProjectEventsInput.safeParse({ projectId: "p1", limit: 201 }).success).toBe(false);
  expect(
    ListProjectEventsInput.parse({ projectId: "p1", before: 12, featureId: FEATURE, sources: ["git"] }),
  ).toMatchObject({ before: 12, featureId: FEATURE, sources: ["git"] });
  expect(PROJECT_EVENTS_RETENTION).toBe(5_000);
});

test("the journal is listed through the rpc", () => {
  expect(RpcRequest.safeParse({ method: "listProjectEvents", projectId: "p1", limit: 10 }).success).toBe(
    true,
  );
  expect(RpcRequest.safeParse({ method: "listProjectEvents", projectId: "p1", limit: 0 }).success).toBe(
    false,
  );
  expect(TRACKING_RPC_METHODS).toContain("listProjectEvents");
});

test("a step put on hold and resumed are journal events with their reason", () => {
  for (const kind of ["held", "resumed"]) {
    const event = { kind, ticketId: TICKET, featureId: FEATURE, source: "user", data: { reason: "MinIO" } };
    expect(ProjectEventInput.parse(event)).toMatchObject({ kind, data: { reason: "MinIO" } });
  }
});
