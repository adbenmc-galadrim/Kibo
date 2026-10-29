import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MomentData, Step } from "@kibo/schema";
import { openRunStore } from "../runs/run-store";
import { openMomentStore, type RunTrace } from "./store";

const dirs: string[] = [];
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-moments-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const say = (text: string): MomentData => ({ kind: "message", text });
const STEP: Step = { id: "s1", title: "Lire", status: "doing", note: null };

test("append numbers moments per run and lists them after a seq", () => {
  const store = openMomentStore(home());
  const a = store.append("r1", say("un"), null, 10);
  const b = store.append("r2", say("autre"), "s1", 11);
  const c = store.append("r1", say("deux"), "s2", 12);
  const d = store.append("r1", { kind: "reminder", reminder: "plan" }, null, 13);
  expect([a.seq, c.seq, d.seq]).toEqual([0, 1, 2]);
  expect(b.seq).toBe(0);
  expect(new Set([a.id, b.id, c.id, d.id]).size).toBe(4);
  expect(store.list("r1").map((m) => m.seq)).toEqual([0, 1, 2]);
  expect(store.list("r1", 0)).toEqual([c, d]);
  expect(c).toEqual({ id: c.id, runId: "r1", seq: 1, at: 12, stepId: "s2", data: say("deux") });
  expect(store.lastOfKind("r1", "message")).toEqual(c);
  expect(store.lastOfKind("r1", "raw")).toBeNull();
  store.close();
});

test("a moment that breaks the schema is refused", () => {
  const store = openMomentStore(home());
  expect(() => store.append("r1", say("x".repeat(8_001)), null, 1)).toThrow("INVALID_INPUT");
  expect(store.list("r1")).toEqual([]);
  store.close();
});

test("moments are append-only", () => {
  const dir = home();
  const store = openMomentStore(dir);
  store.append("r1", say("un"), null, 1);
  const db = new Database(join(dir, "runs.db"));
  expect(() => db.exec("UPDATE run_moments SET at = 2")).toThrow("append-only");
  expect(() => db.exec("DELETE FROM run_moments")).toThrow("append-only");
  db.close();
  store.close();
});

test("traces and internal plans round-trip and are replaced", () => {
  const store = openMomentStore(home());
  expect(store.trace("r1")).toBeNull();
  const trace: RunTrace = {
    runId: "r1",
    path: "/x/s.jsonl",
    offset: 42,
    source: "transcript",
    partial: null,
    doingStep: "s1",
    baseHead: "abc",
    closedAt: null,
  };
  store.saveTrace(trace);
  store.saveTrace({ ...trace, offset: 50, source: "hooks", partial: "unreadable", closedAt: 9 });
  expect(store.trace("r1")).toEqual({
    ...trace,
    offset: 50,
    source: "hooks",
    partial: "unreadable",
    closedAt: 9,
  });
  expect(store.internalPlan("r1")).toBeNull();
  store.saveInternalPlan("r1", [STEP], 1);
  store.saveInternalPlan("r1", [{ ...STEP, status: "done" }], 2);
  expect(store.internalPlan("r1")).toEqual([{ ...STEP, status: "done" }]);
  store.close();
});

test("two connections share runs.db with the run store without SQLITE_BUSY", () => {
  const dir = home();
  const runs = openRunStore(dir);
  const first = openMomentStore(dir);
  const second = openMomentStore(dir);
  for (let i = 0; i < 100; i++) (i % 2 === 0 ? first : second).append("r1", say(`m${i}`), null, i);
  expect(first.list("r1").map((m) => m.seq)).toEqual(Array.from({ length: 100 }, (_, i) => i));
  expect(statSync(join(dir, "runs.db")).mode & 0o777).toBe(0o600);
  first.close();
  second.close();
  runs.close();
});

test("subagent moments stay out of the main thread and form their own page", () => {
  const store = openMomentStore(home());
  const main = store.append("r1", say("principal"), null, 10);
  const sub = store.append("r1", say("sous-agent"), null, 11, "a1");
  const action: MomentData = {
    kind: "actions",
    actions: [
      {
        tool: "Bash",
        kind: "command",
        label: "git diff",
        target: "git diff",
        outcome: "ok",
        detail: null,
        patch: null,
        tests: null,
      },
      {
        tool: "Read",
        kind: "read",
        label: "a.ts",
        target: "a.ts",
        outcome: "ok",
        detail: null,
        patch: null,
        tests: null,
      },
    ],
    summary: "2 actions",
    failed: false,
  };
  store.append("r1", action, null, 12, "a1");
  store.append("r1", say("fin du sous-agent"), null, 13, "a1");
  expect(sub.subagentId).toBe("a1");
  expect(store.list("r1")).toEqual([main]);
  expect(store.lastOfKind("r1", "message")).toEqual(main);
  expect(store.listSubagent("r1", "a1").map((m) => m.seq)).toEqual([1, 2, 3]);
  expect(store.listSubagent("r1", "a1", 2).map((m) => m.seq)).toEqual([3]);
  expect(store.subagentFacts("r1", "a1")).toEqual({ actions: 2, lastText: "fin du sous-agent" });
  expect(store.subagentFacts("r1", "a2")).toEqual({ actions: 0, lastText: null });
  store.close();
});

test("the subagent column migration can run twice on an older database", () => {
  const dir = home();
  const db = new Database(join(dir, "runs.db"), { create: true });
  db.exec(
    "CREATE TABLE run_moments (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, seq INTEGER NOT NULL, " +
      "at INTEGER NOT NULL, step_id TEXT, kind TEXT NOT NULL, data TEXT NOT NULL, UNIQUE (run_id, seq))",
  );
  db.exec(
    `INSERT INTO run_moments (run_id, seq, at, step_id, kind, data) VALUES ('r1', 0, 1, NULL, 'message', '{"kind":"message","text":"ancien"}')`,
  );
  db.close();
  openMomentStore(dir).close();
  const store = openMomentStore(dir);
  expect(store.list("r1").map((m) => m.data)).toEqual([say("ancien")]);
  store.close();
});
