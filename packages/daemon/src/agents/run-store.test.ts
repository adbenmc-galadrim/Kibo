import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { holdWriteLock } from "@kibo/sync-server/testing/hold-write-lock";
import { type NewRun, openRunStore } from "./run-store";

const dirs: string[] = [];
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-runs-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const newRun = (id: string): NewRun => ({
  id,
  projectId: "p1",
  ticketId: "t1",
  ticketKey: "KIB-14",
  ticketTitle: "Récepteur de hooks",
  profileId: "opus",
  profileName: "opus-dev",
  sessionId: `s-${id}`,
  brief: "",
  resumedFrom: null,
});

test("runs get increasing sequence numbers and survive a reopen", () => {
  const h = home();
  const a = openRunStore(h);
  expect(a.create(newRun("r1"), 0, 10)).toEqual({ ...newRun("r1"), seq: 1, createdAt: 10 });
  a.create(newRun("r2"), 1, 20);
  const second = a.append("r1", { type: "admitted", lane: 1 }, 12);
  expect(second).toMatchObject({ at: 12, event: { type: "admitted", lane: 1 } });
  a.close();
  const b = openRunStore(h);
  expect(b.records().map((r) => [r.id, r.seq])).toEqual([
    ["r1", 1],
    ["r2", 2],
  ]);
  expect(b.log("r1").map((e) => e.event)).toEqual([
    { type: "enqueued", rank: 0 },
    { type: "admitted", lane: 1 },
  ]);
  expect(b.events().map((e) => [e.runId, e.event.type])).toEqual([
    ["r1", "enqueued"],
    ["r2", "enqueued"],
    ["r1", "admitted"],
  ]);
  b.close();
});

test("a write waits for another process to release its lock", async () => {
  const h = home();
  const s = openRunStore(h);
  const lock = await holdWriteLock(join(h, "runs.db"), 300);
  s.create(newRun("r1"), 0, 10);
  expect(await lock.released).toBe(0);
  expect(s.records().map((r) => r.id)).toEqual(["r1"]);
  s.close();
});

test("a run without ticket is stored with null ticket fields", () => {
  const s = openRunStore(home());
  const task = { ...newRun("t"), projectId: null, ticketId: null, ticketKey: null, ticketTitle: "Générer" };
  s.create(task, 0, 1);
  expect(s.records()).toEqual([{ ...task, seq: 1, createdAt: 1 }]);
  s.close();
});

test("the log is append-only, even through raw SQL", () => {
  const h = home();
  const s = openRunStore(h);
  s.create(newRun("r1"), 0, 1);
  s.saveTokenHash("r1", "h1", 1);
  const raw = new Database(join(h, "runs.db"));
  expect(() => raw.exec("UPDATE runs SET brief = 'x'")).toThrow("append-only");
  expect(() => raw.exec("DELETE FROM run_events")).toThrow("append-only");
  expect(() => raw.exec("DELETE FROM run_tokens")).toThrow("append-only");
  raw.close();
  s.close();
});

test("events of an unknown run are refused", () => {
  const s = openRunStore(home());
  expect(() => s.append("nope", { type: "cancelled" }, 1)).toThrow("NOT_FOUND");
  s.close();
});

test("the latest token hash of a run wins", () => {
  const s = openRunStore(home());
  s.create(newRun("r1"), 0, 1);
  expect(s.tokenHash("r1")).toBeNull();
  s.saveTokenHash("r1", "h1", 1);
  s.saveTokenHash("r1", "h2", 2);
  expect(s.tokenHash("r1")).toBe("h2");
  s.close();
});

test("host settings are merged, validated and kept", () => {
  const h = home();
  const s = openRunStore(h);
  expect(s.hostSettings()).toEqual({});
  s.saveHostSettings({ hostSlots: 4 });
  s.saveHostSettings({ paused: true });
  s.close();
  const again = openRunStore(h);
  expect(again.hostSettings()).toEqual({ hostSlots: 4, paused: true });
  again.close();
});

test("the database is private to the user", () => {
  const h = home();
  openRunStore(h).close();
  expect(statSync(join(h, "runs.db")).mode & 0o777).toBe(0o600);
});

test("a corrupted file or event is reported, never ignored", () => {
  const h = home();
  writeFileSync(join(h, "runs.db"), "not a database at all, just text".repeat(100));
  expect(() => openRunStore(h)).toThrow("STORE_CORRUPT");
  const h2 = home();
  const s = openRunStore(h2);
  s.create(newRun("r1"), 0, 1);
  const raw = new Database(join(h2, "runs.db"));
  raw.exec("INSERT INTO run_events (run_id, at, data) VALUES ('r1', 1, '{\"type\":\"teleported\"}')");
  raw.close();
  expect(() => s.log("r1")).toThrow("STORE_CORRUPT");
  s.close();
});

test("vacuumInto writes a readable snapshot of the runs", () => {
  const h = home();
  const store = openRunStore(h);
  store.create(newRun("r1"), 0, 1);
  const target = join(h, "copy.db");
  store.vacuumInto(target);
  store.close();
  const db = new Database(target, { readonly: true });
  expect(db.query("SELECT id FROM runs").all()).toEqual([{ id: "r1" }]);
  db.close();
});
