import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createEventLog, type EventLogLimits, ensureEventsTable } from "./events";

const refusal = (instanceId: string, code = "PERMISSION_DENIED") => ({
  projectId: "p1",
  instanceId,
  ref: "evil@0.1.0",
  kind: "list",
  code,
});

function log(limits?: EventLogLimits) {
  const db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  const clock = { now: 0 };
  const events = createEventLog(db, () => ++clock.now, limits);
  const rows = () => db.query<{ n: number }, []>("SELECT count(*) AS n FROM component_events").get()?.n;
  return { db, clock, events, rows };
}

test("refusals are listed oldest first with their timestamp", () => {
  const { events } = log();
  events.record(refusal("a"));
  events.record(refusal("b", "RATE_LIMITED"));
  expect(events.list()).toEqual([
    {
      at: 1,
      projectId: "p1",
      instanceId: "a",
      ref: "evil@0.1.0",
      kind: "list",
      code: "PERMISSION_DENIED",
      count: 1,
    },
    {
      at: 2,
      projectId: "p1",
      instanceId: "b",
      ref: "evil@0.1.0",
      kind: "list",
      code: "RATE_LIMITED",
      count: 1,
    },
  ]);
  expect(events.list(1)).toHaveLength(1);
});

test("a burst of identical refusals gets a few rows then one counted summary", () => {
  const { events } = log({ burst: 3 });
  for (let i = 0; i < 50; i++) events.record(refusal("evil"));
  expect(events.list().map((e) => [e.at, e.count])).toEqual([
    [1, 1],
    [2, 1],
    [3, 1],
    [50, 47],
  ]);
});

test("counted refusals never touch SQLite", () => {
  const { events, rows } = log({ burst: 3 });
  for (let i = 0; i < 30; i++) {
    events.record(refusal("evil"));
    expect(rows()).toBe(Math.min(i + 1, 3));
  }
});

test("another key is written immediately in the middle of a flood", () => {
  const { events, rows } = log({ burst: 3 });
  for (let i = 0; i < 30; i++) events.record(refusal("evil"));
  events.record(refusal("evil", "RATE_LIMITED"));
  expect(rows()).toBe(4);
  events.record(refusal("quiet"));
  expect(rows()).toBe(5);
});

test("after the window, the next refusal writes the summary then its own row", () => {
  const { events, clock } = log({ burst: 3, windowMs: 1_000 });
  for (let i = 0; i < 5; i++) events.record(refusal("evil"));
  clock.now = 2_000;
  events.record(refusal("evil"));
  expect(events.list().map((e) => [e.at, e.count])).toEqual([
    [1, 1],
    [2, 1],
    [3, 1],
    [5, 2],
    [2_001, 1],
  ]);
});

test("expired windows of other keys are summarized on each insertion", () => {
  const { events, clock, db } = log({ burst: 1, windowMs: 1_000 });
  for (let i = 0; i < 4; i++) events.record(refusal("evil"));
  clock.now = 2_000;
  events.record(refusal("quiet"));
  const stored = db.query<{ instanceId: string; count: number }, []>(
    "SELECT instance_id AS instanceId, count FROM component_events ORDER BY id",
  );
  expect(stored.all()).toEqual([
    { instanceId: "evil", count: 1 },
    { instanceId: "evil", count: 3 },
    { instanceId: "quiet", count: 1 },
  ]);
});

test("flush writes pending counts and keeps the window open", () => {
  const { events, rows } = log({ burst: 1 });
  for (let i = 0; i < 4; i++) events.record(refusal("evil"));
  events.flush();
  expect(rows()).toBe(2);
  events.flush();
  expect(rows()).toBe(2);
  events.record(refusal("evil"));
  events.flush();
  expect(events.list().map((e) => e.count)).toEqual([1, 3, 1]);
});

test("a flooding instance keeps only its latest refusals and cannot evict the others", () => {
  const { events } = log({ maxPerInstance: 3, maxRows: 100, burst: 100 });
  events.record(refusal("quiet"));
  for (let i = 0; i < 50; i++) events.record(refusal("evil"));
  const kept = events.list();
  expect(kept.filter((e) => e.instanceId === "quiet")).toHaveLength(1);
  expect(kept.filter((e) => e.instanceId === "evil").map((e) => e.at)).toEqual([49, 50, 51]);
});

test("the whole journal is capped", () => {
  const { events, rows } = log({ maxPerInstance: 10, maxRows: 5 });
  for (let i = 0; i < 20; i++) events.record(refusal(`i${i}`));
  expect(events.list().map((e) => e.instanceId)).toEqual(["i15", "i16", "i17", "i18", "i19"]);
  expect(rows()).toBe(5);
});
