import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SignalKind } from "@kibo/schema";
import { openRunStore } from "../agents/run-store";
import { type NewSignal, openSignalStore, type SignalStore } from "./store";

const dirs: string[] = [];
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-signal-store-"));
  dirs.push(d);
  return d;
};
const stores: SignalStore[] = [];
const open = (h: string) => {
  const store = openSignalStore(h);
  stores.push(store);
  return store;
};
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const ADAM = { kind: "human" as const, ref: "adam" };
let ids = 0;
const signal = (p: Partial<NewSignal> = {}): NewSignal => ({
  id: `s${++ids}`,
  projectId: "p1",
  runId: "r1",
  runLabel: "opus-dev-2",
  profileName: "opus",
  originTicketId: "t14",
  originTicketKey: "KIB-14",
  ticketId: "t14",
  ticketKey: "KIB-14",
  kind: "ticket",
  title: `Signal ${ids}`,
  body: "",
  createdAt: 10 * ids,
  ...p,
});

const eventCount = (h: string): number => {
  const db = new Database(join(h, "runs.db"));
  const { n } = db.query("SELECT COUNT(*) AS n FROM project_signal_events").get() as { n: number };
  db.close();
  return n;
};

test("signals are numbered per project and start new", () => {
  const store = open(home());
  const a = store.create(signal());
  const b = store.create(signal());
  const other = store.create(signal({ projectId: "p2" }));
  const c = store.create(signal());
  expect([a.seq, b.seq, c.seq, other.seq]).toEqual([1, 2, 3, 1]);
  expect(c).toMatchObject({ ref: "sig:3", status: "new", readAt: null, decidedBy: null });
  expect(store.get(b.id)).toEqual(b);
});

test("opening next to the runs adds the signal tables, append-only, in a 0600 runs.db", () => {
  const h = home();
  const runs = openRunStore(h);
  const store = open(h);
  store.create(signal());
  store.appendEvent(store.open("p1")[0]?.id ?? "", { type: "read", runId: "pa" }, 50);
  const db = new Database(join(h, "runs.db"));
  expect(() => db.exec("UPDATE project_signals SET title = 'x'")).toThrow("append-only");
  expect(() => db.exec("DELETE FROM project_signals")).toThrow("append-only");
  expect(() => db.exec("UPDATE project_signal_events SET at = 0")).toThrow("append-only");
  expect(() => db.exec("DELETE FROM project_signal_events")).toThrow("append-only");
  db.close();
  runs.close();
  expect(statSync(join(h, "runs.db")).mode & 0o777).toBe(0o600);
});

test("events fold the signal; a final signal keeps its first decision and nothing more is written", () => {
  const h = home();
  const store = open(h);
  const s = store.create(signal());
  expect(store.appendEvent(s.id, { type: "read", runId: "pa" }, 50)).toMatchObject({
    status: "read",
    readAt: 50,
    readRunId: "pa",
  });
  expect(store.appendEvent(s.id, { type: "read", runId: "pb" }, 55)).toMatchObject({ readRunId: "pa" });
  expect(eventCount(h)).toBe(1);
  const handled = store.appendEvent(s.id, { type: "handled", batchId: "b1", actionId: 2 }, 60);
  expect(handled).toMatchObject({ status: "handled", batchId: "b1", actionId: 2, decidedAt: 60, readAt: 50 });
  const again = store.appendEvent(s.id, { type: "ignored", by: ADAM, batchId: null, actionId: null }, 70);
  expect(again).toEqual(handled);
  expect(eventCount(h)).toBe(2);
  expect(() => store.appendEvent("nope", { type: "read", runId: "pa" }, 1)).toThrow("not found");
});

test("signals are found by id and by reference within their project", () => {
  const store = open(home());
  store.create(signal());
  const second = store.create(signal());
  store.create(signal({ projectId: "p2" }));
  expect(store.byRef("p1", "sig:2")).toEqual(second);
  expect(store.byRef("p2", "sig:2")).toBeNull();
  expect(store.byRef("p1", "sig:9")).toBeNull();
  expect(store.get("nope")).toBeNull();
});

test("open signals go oldest first; closed ones most recently closed first, bounded", () => {
  const store = open(home());
  const all = Array.from({ length: 5 }, () => store.create(signal()));
  const at = (i: number) => all[i]?.id ?? "";
  store.appendEvent(at(1), { type: "read", runId: "pa" }, 100);
  store.appendEvent(at(0), { type: "handled", batchId: "b1", actionId: 1 }, 110);
  store.appendEvent(at(3), { type: "ignored", by: ADAM, batchId: null, actionId: null }, 120);
  store.appendEvent(at(2), { type: "handled", batchId: "b1", actionId: 2 }, 130);
  expect(store.open("p1").map((s) => s.ref)).toEqual(["sig:2", "sig:5"]);
  expect(store.closed("p1", 20).map((s) => s.ref)).toEqual(["sig:3", "sig:4", "sig:1"]);
  expect(store.closed("p1", 2).map((s) => s.ref)).toEqual(["sig:3", "sig:4"]);
  expect(store.open("p2")).toEqual([]);
});

test("quota and duplicates are counted per run", () => {
  const store = open(home());
  store.create(signal({ kind: "ticket", title: "Tests" }));
  store.create(signal({ kind: "context", title: "Ordre" }));
  store.create(signal({ runId: "r2", kind: "blocker", title: "Attend" }));
  expect(store.countByRun("r1")).toBe(2);
  expect(store.countByRun("r3")).toBe(0);
  const dup = (runId: string, kind: SignalKind, title: string) => store.duplicate(runId, kind, title);
  expect(dup("r1", "ticket", "Tests")).toBe(true);
  expect(dup("r1", "context", "Tests")).toBe(false);
  expect(dup("r2", "ticket", "Tests")).toBe(false);
});

test("counts give the open and unread signals of each project that has some", () => {
  const store = open(home());
  const a = store.create(signal());
  const b = store.create(signal());
  store.create(signal());
  const c = store.create(signal({ projectId: "p2" }));
  store.appendEvent(a.id, { type: "read", runId: "pa" }, 1);
  store.appendEvent(b.id, { type: "handled", batchId: "b1", actionId: 1 }, 2);
  store.appendEvent(c.id, { type: "ignored", by: ADAM, batchId: null, actionId: null }, 3);
  expect(store.counts()).toEqual([{ projectId: "p1", open: 2, unread: 1 }]);
});

test("wake-ups default to nothing, round-trip, and the due ones are listed", () => {
  const store = open(home());
  expect(store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: null, dueAt: null });
  store.saveWakeup({ projectId: "p1", lastAt: 100, dueAt: 700 });
  store.saveWakeup({ projectId: "p2", lastAt: 100, dueAt: null });
  expect(store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: 100, dueAt: 700 });
  expect(store.due()).toEqual([{ projectId: "p1", lastAt: 100, dueAt: 700 }]);
  store.saveWakeup({ projectId: "p1", lastAt: 700, dueAt: null });
  expect(store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: 700, dueAt: null });
  expect(store.due()).toEqual([]);
});

test("answers wait once per question, per project, and survive a reopening", () => {
  const h = home();
  const store = open(h);
  store.queueAnswer("p1", "q1", 10);
  store.queueAnswer("p1", "q2", 20);
  store.queueAnswer("p1", "q1", 30);
  store.queueAnswer("p2", "q9", 5);
  expect(store.queuedAnswers("p1")).toEqual(["q1", "q2"]);
  expect(store.queuedAnswers("p3")).toEqual([]);
  expect(open(h).queuedAnswers("p1")).toEqual(["q1", "q2"]);
  store.dropAnswers("p1");
  expect(store.queuedAnswers("p1")).toEqual([]);
  expect(store.queuedAnswers("p2")).toEqual(["q9"]);
});

test("two connections create a hundred signals in turn without a busy error or a duplicate rank", async () => {
  const h = home();
  const first = open(h);
  const second = open(h);
  const created = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      Promise.resolve().then(() => (i % 2 ? first : second).create(signal())),
    ),
  );
  expect(new Set(created.map((s) => s.seq)).size).toBe(100);
  expect(Math.max(...created.map((s) => s.seq))).toBe(100);
});

test("a stored signal of an unknown kind is STORE_CORRUPT", () => {
  const h = home();
  const store = open(h);
  const db = new Database(join(h, "runs.db"));
  db.query(
    "INSERT INTO project_signals (id, project_id, seq, run_id, run_label, profile_name, origin_ticket_id, " +
      "origin_ticket_key, ticket_id, ticket_key, kind, title, body, created_at) " +
      "VALUES ('x', 'p1', 1, 'r', 'l', 'p', 't', 'K-1', 't', 'K-1', 'idea', 'T', '', 1)",
  ).run();
  db.close();
  expect(() => store.get("x")).toThrow("STORE_CORRUPT");
});
