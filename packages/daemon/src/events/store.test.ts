import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { PROJECT_EVENTS_RETENTION, type ProjectEventInput } from "@kibo/schema";
import { createEventStore, type EventStore } from "./store";

let db: Database;
let clock: number;
let store: EventStore;

beforeEach(() => {
  db = new Database(":memory:");
  clock = 1_000;
  store = createEventStore(db, () => clock);
});

const event = (over: Partial<ProjectEventInput> = {}): ProjectEventInput => ({
  kind: "status_changed",
  ticketId: "t1",
  featureId: "f1",
  source: "user",
  data: { from: "todo", to: "in_progress" },
  ...over,
});

const list = (over: Record<string, unknown> = {}) => store.list({ projectId: "p1", limit: 50, ...over });

test("appended events get growing ids and the time of the clock", () => {
  const first = store.append("p1", event());
  clock = 2_000;
  const second = store.append("p1", event({ kind: "pr_opened", source: "git", data: { number: 22 } }));
  expect(second.id).toBeGreaterThan(first.id);
  expect(second).toEqual({
    id: second.id,
    projectId: "p1",
    at: 2_000,
    kind: "pr_opened",
    ticketId: "t1",
    featureId: "f1",
    source: "git",
    data: { number: 22 },
  });
});

test("events are listed newest first, a page at a time, per project", () => {
  const ids = [1, 2, 3].map(() => store.append("p1", event()).id);
  store.append("p2", event());
  const page = list({ limit: 2 });
  expect(page.items.map((e) => e.id)).toEqual(ids.slice(1).reverse());
  expect(page.nextBefore).toBe(ids[1] ?? null);
  const rest = list({ limit: 2, before: page.nextBefore });
  expect(rest.items.map((e) => e.id)).toEqual(ids.slice(0, 1));
  expect(rest.nextBefore).toBeNull();
});

test("events are filtered by source, ticket and feature", () => {
  store.append("p1", event({ source: "git", ticketId: "t1", featureId: "f1" }));
  store.append("p1", event({ source: "full-delivery", ticketId: "t2", featureId: "f1" }));
  store.append("p1", event({ source: "user", ticketId: "t3", featureId: "f2" }));
  const sources = (page: { items: { source: string }[] }) => page.items.map((e) => e.source);
  expect(sources(list({ sources: ["git", "full-delivery"] }))).toEqual(["full-delivery", "git"]);
  expect(sources(list({ ticketId: "t2" }))).toEqual(["full-delivery"]);
  expect(sources(list({ featureId: "f1" }))).toEqual(["full-delivery", "git"]);
  expect(sources(list({ sources: [] }))).toEqual(["user", "full-delivery", "git"]);
});

test("beyond the retention, the oldest event of the project is erased", () => {
  const insert = db.transaction(() => {
    for (let i = 0; i < PROJECT_EVENTS_RETENTION; i += 1) store.append("p1", event());
  });
  insert();
  store.append("p2", event());
  const firstId = db.query<{ id: number }, []>("SELECT MIN(id) AS id FROM project_events").get()?.id;
  store.append("p1", event());
  const count = (p: string) =>
    db.query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM project_events WHERE project_id = ?").get(p)
      ?.n;
  expect(count("p1")).toBe(PROJECT_EVENTS_RETENTION);
  expect(count("p2")).toBe(1);
  expect(list({ limit: 200 }).items.some((e) => e.id === firstId)).toBe(false);
});

test("the last event time of each ticket follows the appends", () => {
  store.append("p1", event({ ticketId: "t1" }));
  clock = 5_000;
  store.append("p1", event({ ticketId: "t2" }));
  expect(store.lastEventAt("p1")).toEqual(
    new Map([
      ["t1", 1_000],
      ["t2", 5_000],
    ]),
  );
  clock = 9_000;
  store.append("p1", event({ ticketId: "t1" }));
  store.append("p1", event({ ticketId: null, kind: "sprint_created" }));
  expect(store.lastEventAt("p1").get("t1")).toBe(9_000);
  expect(store.lastEventAt("p1").size).toBe(2);
  expect(
    createEventStore(db, () => 0)
      .lastEventAt("p1")
      .get("t1"),
  ).toBe(9_000);
  expect(store.lastEventAt("p2").size).toBe(0);
});

const insertRaw = (kind: string, data: string) =>
  db.run(
    "INSERT INTO project_events (project_id, at, kind, ticket_id, feature_id, source, data) VALUES (?, 1, ?, NULL, NULL, 'user', ?)",
    ["p1", kind, data],
  );

test("a corrupt event in the journal is reported, never skipped", () => {
  insertRaw("status_changed", "{oops");
  expect(() => list()).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
});

test("an event of an unknown kind is reported as corrupt", () => {
  insertRaw("unknown", "{}");
  expect(() => list()).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
});

test("the journal is append-only: an event is never rewritten", () => {
  store.append("p1", event());
  expect(() => db.run("UPDATE project_events SET kind = 'pr_opened'")).toThrow("append-only");
});
