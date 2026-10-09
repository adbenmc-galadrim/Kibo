import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchEvent, ProjectFingerprint, ProposedAction } from "@kibo/schema";
import { openRunStore } from "../agents/run-store";
import { type NewBatch, openProjectAgentStore } from "./store";

const dirs: string[] = [];
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-pa-store-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const ACTION: ProposedAction = {
  id: 1,
  why: "trop long",
  type: "setStatus",
  ticket: "EMIS-1",
  statusId: "done",
};
const ADAM = { kind: "human" as const, ref: "adam" };
const FP: ProjectFingerprint = {
  tickets: {
    t1: {
      key: "EMIS-1",
      title: "A",
      statusId: "todo",
      labels: [],
      parentId: null,
      assignee: null,
      branch: null,
      pr: null,
    },
  },
  questions: {},
  runs: {},
  notes: {},
};

const newBatch = (id: string, p: Partial<NewBatch> = {}): NewBatch => ({
  id,
  projectId: "p1",
  runId: "r1",
  sessionId: "s1",
  summary: "Ranger",
  actions: [ACTION],
  expected: [{ actionId: 1, fields: { statusId: "todo" } }],
  createdAt: 10,
  ...p,
});
const decided = (decision: "apply" | "reject"): BatchEvent => ({
  type: "decided",
  decision,
  by: ADAM,
  actionIds: decision === "apply" ? [1] : null,
  comment: null,
});

test("opening on an existing runs.db adds the tables next to the runs", () => {
  const h = home();
  const runs = openRunStore(h);
  const store = openProjectAgentStore(h);
  const db = new Database(join(h, "runs.db"));
  const tables = (
    db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((t) => t.name);
  expect(tables).toEqual(
    expect.arrayContaining([
      "runs",
      "project_agent_sessions",
      "project_agent_batches",
      "project_agent_batch_events",
    ]),
  );
  db.close();
  store.close();
  runs.close();
});

test("batches and their events are append-only", () => {
  const h = home();
  const store = openProjectAgentStore(h);
  store.createBatch(newBatch("b1"));
  store.appendBatchEvent("b1", { type: "superseded" }, 11);
  const db = new Database(join(h, "runs.db"));
  expect(() => db.exec("UPDATE project_agent_batches SET summary = 'x'")).toThrow("append-only");
  expect(() => db.exec("DELETE FROM project_agent_batches")).toThrow("append-only");
  expect(() => db.exec("UPDATE project_agent_batch_events SET at = 0")).toThrow("append-only");
  expect(() => db.exec("DELETE FROM project_agent_batch_events")).toThrow("append-only");
  db.close();
  store.close();
});

test("one open session per project; closing lets a new one start; most recent first", () => {
  const store = openProjectAgentStore(home());
  const first = store.startSession({ projectId: "p1", runId: "r1", sessionId: "s1", startedAt: 1 });
  expect(first).toEqual({
    projectId: "p1",
    runId: "r1",
    sessionId: "s1",
    startedAt: 1,
    closedAt: null,
    lastTurnAt: null,
  });
  expect(() => store.startSession({ projectId: "p1", runId: "r2", sessionId: "s2", startedAt: 2 })).toThrow(
    expect.objectContaining({ code: "CONFLICT" }),
  );
  store.startSession({ projectId: "p2", runId: "r9", sessionId: "s9", startedAt: 2 });
  store.closeSession("r1", 5);
  expect(store.openSession("p1")).toBeNull();
  store.startSession({ projectId: "p1", runId: "r2", sessionId: "s2", startedAt: 6 });
  expect(store.openSession("p1")?.runId).toBe("r2");
  expect(store.sessions("p1").map((s) => [s.runId, s.closedAt])).toEqual([
    ["r2", null],
    ["r1", 5],
  ]);
  expect(store.openSessions().map((s) => s.projectId)).toEqual(["p1", "p2"]);
  store.close();
});

test("the fingerprint is read back through its schema; a corrupt one is STORE_CORRUPT", () => {
  const h = home();
  const store = openProjectAgentStore(h);
  store.startSession({ projectId: "p1", runId: "r1", sessionId: "s1", startedAt: 1 });
  expect(store.fingerprint("r1")).toBeNull();
  store.saveFingerprint("r1", FP, 7);
  expect(store.fingerprint("r1")).toEqual(FP);
  expect(store.openSession("p1")?.lastTurnAt).toBe(7);
  const db = new Database(join(h, "runs.db"));
  db.exec(`UPDATE project_agent_sessions SET fingerprint = '{"tickets": 3}'`);
  db.close();
  expect(() => store.fingerprint("r1")).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
  store.close();
});

test("batches are numbered per project and folded from their events", () => {
  const store = openProjectAgentStore(home());
  expect(store.createBatch(newBatch("b1"))).toMatchObject({ seq: 1, status: "pending", results: [] });
  expect(store.createBatch(newBatch("b2")).seq).toBe(2);
  expect(store.createBatch(newBatch("c1", { projectId: "p2", runId: "r2" })).seq).toBe(1);
  expect(store.pendingBatch("p1")?.id).toBe("b2");
  const applying = store.appendBatchEvent("b2", decided("apply"), 20);
  expect(applying).toMatchObject({
    status: "partial",
    decidedBy: ADAM,
    decidedAt: 20,
    chosen: [1],
    results: [],
  });
  const done = store.appendBatchEvent(
    "b2",
    { type: "results", results: [{ actionId: 1, outcome: "applied", detail: null, created: null }] },
    21,
  );
  expect(done.status).toBe("applied");
  expect(store.batch("b2")).toEqual(done);
  expect(store.pendingBatch("p1")?.id).toBe("b1");
  expect(store.batches("r1").map((b) => b.id)).toEqual(["b1", "b2"]);
  expect(store.batch("nope")).toBeNull();
  expect(() => store.appendBatchEvent("nope", { type: "abandoned" }, 1)).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  store.close();
});

test("lastDecided gives the latest batch decided since a time", () => {
  const store = openProjectAgentStore(home());
  store.createBatch(newBatch("b1"));
  store.createBatch(newBatch("b2"));
  store.appendBatchEvent("b1", decided("reject"), 10);
  store.appendBatchEvent("b2", { type: "superseded" }, 12);
  expect(store.lastDecided("p1", 5)?.id).toBe("b1");
  expect(store.lastDecided("p1", 11)).toBeNull();
  expect(store.lastDecided("p2", 0)).toBeNull();
  store.close();
});

test("a backup of the run store carries the project agent tables", () => {
  const h = home();
  const runs = openRunStore(h);
  const store = openProjectAgentStore(h);
  store.startSession({ projectId: "p1", runId: "r1", sessionId: "s1", startedAt: 1 });
  store.createBatch(newBatch("b1"));
  const copy = join(h, "copy.db");
  runs.vacuumInto(copy);
  store.close();
  runs.close();
  const db = new Database(copy);
  expect(db.query("SELECT COUNT(*) AS n FROM project_agent_batches").get()).toEqual({ n: 1 });
  expect(db.query("SELECT run_id FROM project_agent_sessions").get()).toEqual({ run_id: "r1" });
  db.close();
});
