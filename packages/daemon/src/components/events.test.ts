import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createEventLog, ensureEventsTable } from "./events";

const refusal = (instanceId: string, code = "PERMISSION_DENIED") => ({
  projectId: "p1",
  instanceId,
  ref: "evil@0.1.0",
  kind: "list",
  code,
});

function log(opts?: { maxRows?: number; maxPerInstance?: number }) {
  const db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  let now = 0;
  return { db, events: createEventLog(db, () => ++now, opts) };
}

test("refusals are listed oldest first with their timestamp", () => {
  const { events } = log();
  events.record(refusal("a"));
  events.record(refusal("b", "RATE_LIMITED"));
  expect(events.list()).toEqual([
    { at: 1, projectId: "p1", instanceId: "a", ref: "evil@0.1.0", kind: "list", code: "PERMISSION_DENIED" },
    { at: 2, projectId: "p1", instanceId: "b", ref: "evil@0.1.0", kind: "list", code: "RATE_LIMITED" },
  ]);
  expect(events.list(1)).toHaveLength(1);
});

test("a flooding instance keeps only its latest refusals and cannot evict the others", () => {
  const { events } = log({ maxPerInstance: 3, maxRows: 100 });
  events.record(refusal("quiet"));
  for (let i = 0; i < 50; i++) events.record(refusal("evil"));
  const kept = events.list();
  expect(kept.filter((e) => e.instanceId === "quiet")).toHaveLength(1);
  expect(kept.filter((e) => e.instanceId === "evil").map((e) => e.at)).toEqual([49, 50, 51]);
});

test("the whole journal is capped", () => {
  const { db, events } = log({ maxPerInstance: 10, maxRows: 5 });
  for (let i = 0; i < 20; i++) events.record(refusal(`i${i}`));
  expect(events.list().map((e) => e.instanceId)).toEqual(["i15", "i16", "i17", "i18", "i19"]);
  expect(db.query("SELECT count(*) AS n FROM component_events").get()).toEqual({ n: 5 });
});
