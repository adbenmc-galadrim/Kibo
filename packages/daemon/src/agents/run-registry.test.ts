import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ASK_TOOL, type RunEvent } from "@kibo/schema";
import { openRunRegistry } from "./run-registry";
import { type NewRun, openRunStore } from "./run-store";

const dirs: string[] = [];
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-registry-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const newRun = (id: string): NewRun => ({
  id,
  projectId: "p1",
  ticketId: `t-${id}`,
  ticketKey: "KIB-14",
  ticketTitle: "Récepteur",
  profileId: "opus",
  profileName: "opus-dev",
  sessionId: `s-${id}`,
  brief: "",
  resumedFrom: null,
});
const spawned: RunEvent = { type: "spawned", pid: 1, resume: false, workspace: "isolated", guidelines: 0 };
const question: RunEvent = {
  type: "hook",
  payload: {
    event: "PostToolUse",
    sessionId: "s",
    transcriptPath: null,
    tool: ASK_TOOL,
    detail: null,
    question: "?",
    agentId: null,
    ask: null,
  },
};
const exit = (tokens: number): RunEvent => ({
  type: "exited",
  code: 0,
  isError: false,
  result: "ok",
  tokens,
  costUsd: 0,
  denied: [],
});
let clock = 1000;
const now = () => clock;

test("creates and advances runs, telling listeners the previous state", () => {
  const store = openRunStore(home());
  const reg = openRunRegistry(store, now);
  const seen: string[] = [];
  reg.onChange((run, previous) => seen.push(`${previous ?? "-"}>${run.state}`));
  expect(reg.create(newRun("r1"), 0)).toMatchObject({ id: "r1", seq: 1, state: "queued", createdAt: 1000 });
  clock = 1100;
  expect(reg.apply("r1", { type: "admitted", lane: 1 })).toMatchObject({
    state: "starting",
    label: "opus-dev-1",
  });
  expect(seen).toEqual(["->queued", "queued>starting"]);
  expect(reg.log("r1").map((e) => e.event.type)).toEqual(["enqueued", "admitted"]);
  expect(() => reg.get("nope")).toThrow("NOT_FOUND");
  store.close();
});

test("a refused transition appends nothing", () => {
  const store = openRunStore(home());
  const reg = openRunRegistry(store, now);
  reg.create(newRun("r1"), 0);
  expect(() => reg.apply("r1", { type: "requeued", rank: 0 })).toThrow("INVALID_TRANSITION");
  expect(() => reg.apply("r1", spawned)).toThrow("INVALID_TRANSITION");
  expect(store.log("r1")).toHaveLength(1);
  expect(reg.get("r1").state).toBe("queued");
  store.close();
});

test("restart fails interrupted runs and keeps the others", () => {
  const h = home();
  const store = openRunStore(h);
  const reg = openRunRegistry(store, now);
  for (const id of ["running", "waiting", "queued", "done"]) reg.create(newRun(id), 0);
  for (const id of ["running", "waiting", "done"]) {
    reg.apply(id, { type: "admitted", lane: 1 });
    reg.apply(id, spawned);
  }
  reg.apply("waiting", question);
  reg.apply("waiting", exit(10));
  reg.apply("done", exit(20));
  const before = reg.all();
  store.close();

  clock = 5000;
  const reopened = openRunStore(h);
  const again = openRunRegistry(reopened, now);
  const state = (id: string) => again.get(id).state;
  expect([state("running"), state("waiting"), state("queued"), state("done")]).toEqual([
    "failed",
    "waiting_input",
    "queued",
    "done",
  ]);
  expect(again.get("running").error).toStartWith("INTERRUPTED");
  expect(again.interrupted().map((r) => r.id)).toEqual(["running"]);
  expect(before.find((r) => r.id === "waiting")).toEqual(again.get("waiting"));
  expect(reopened.log("running").at(-1)?.event).toEqual({
    type: "failed",
    error: "INTERRUPTED: the daemon restarted during the run",
  });
  reopened.close();

  const thirdStore = openRunStore(h);
  const third = openRunRegistry(thirdStore, now);
  expect(third.log("running").filter((e) => e.event.type === "failed")).toHaveLength(1);
  thirdStore.close();
});

test("counts the tokens of the day", () => {
  const store = openRunStore(home());
  const reg = openRunRegistry(store, now);
  clock = 1000;
  reg.create(newRun("r1"), 0);
  reg.apply("r1", { type: "admitted", lane: 1 });
  reg.apply("r1", spawned);
  reg.apply("r1", exit(300));
  expect(reg.tokensSince(0)).toBe(300);
  expect(reg.tokensSince(2000)).toBe(0);
  store.close();
});

const activity: RunEvent = {
  type: "hook",
  payload: {
    event: "PreToolUse",
    sessionId: "s",
    transcriptPath: null,
    tool: "Read",
    detail: null,
    question: null,
    agentId: null,
    ask: null,
  },
};

test("an interrupted run is closed at its last event, not at the restart; queued runs keep their message", () => {
  const h = home();
  const store = openRunStore(h);
  const reg = openRunRegistry(store, now);
  clock = 1000;
  for (const id of ["running", "starting", "queued"]) reg.create(newRun(id), 0);
  clock = 1100;
  reg.apply("running", { type: "admitted", lane: 1 });
  reg.apply("starting", { type: "admitted", lane: 2 });
  clock = 1200;
  reg.apply("running", spawned);
  clock = 1500;
  reg.apply("running", activity);
  reg.apply("queued", { type: "answered", text: "Commence par les tests.", rank: 0 });
  store.close();

  clock = 9_000;
  const reopened = openRunStore(h);
  const again = openRunRegistry(reopened, now);
  expect(again.get("running")).toMatchObject({
    state: "failed",
    activeMs: 300,
    turnStartedAt: null,
    session: null,
    endedAt: 1500,
    stateSince: 1500,
  });
  expect(again.get("starting")).toMatchObject({
    state: "failed",
    activeMs: 0,
    endedAt: 1100,
    stateSince: 1100,
  });
  expect(again.get("queued")).toMatchObject({
    state: "queued",
    pendingAnswer: "Commence par les tests.",
    rank: 0,
  });
  expect(
    again
      .interrupted()
      .map((r) => r.id)
      .sort(),
  ).toEqual(["running", "starting"]);
  expect(reopened.log("running").at(-1)).toMatchObject({ at: 1500, event: { type: "failed" } });
  expect(reopened.log("starting").at(-1)).toMatchObject({ at: 1100, event: { type: "failed" } });
  reopened.close();

  const thirdStore = openRunStore(h);
  const third = openRunRegistry(thirdStore, now);
  expect(third.get("running")).toMatchObject({ state: "failed", activeMs: 300, endedAt: 1500 });
  expect(third.interrupted()).toEqual([]);
  thirdStore.close();
});

test("a journal closed at the restart time by an older daemon replays unchanged", () => {
  const h = home();
  const store = openRunStore(h);
  const reg = openRunRegistry(store, now);
  clock = 1000;
  reg.create(newRun("r1"), 0);
  reg.apply("r1", { type: "admitted", lane: 1 });
  clock = 1200;
  reg.apply("r1", spawned);
  store.append("r1", { type: "failed", error: "INTERRUPTED: the daemon restarted during the run" }, 5_000);
  store.close();

  clock = 9_000;
  const reopened = openRunStore(h);
  const again = openRunRegistry(reopened, now);
  expect(again.get("r1")).toMatchObject({ state: "failed", activeMs: 3_800, endedAt: 5_000 });
  expect(again.interrupted()).toEqual([]);
  expect(reopened.log("r1").filter((e) => e.event.type === "failed")).toHaveLength(1);
  reopened.close();
});

test("a replayed journal keeps the inherited origin, its session line and the session it ran", () => {
  const h = home();
  const store = openRunStore(h);
  const reg = openRunRegistry(store, now);
  reg.create(newRun("old"), 0);
  reg.apply("old", { type: "admitted", lane: 1 });
  reg.apply("old", spawned);
  reg.create({ ...newRun("next"), sessionId: "s-old", resumedFrom: "old" }, 1);
  reg.apply("next", { type: "admitted", lane: 2 });
  reg.apply("next", { type: "session", mode: "fresh", reason: "transcript_missing" });
  reg.apply("next", { ...spawned, sessionId: "s-fresh" });
  store.close();

  const reopened = openRunStore(h);
  const again = openRunRegistry(reopened, now);
  expect(again.get("old")).toMatchObject({ sessionId: "s-old", resumedFrom: null, session: null });
  expect(again.get("next")).toMatchObject({
    sessionId: "s-fresh",
    resumedFrom: "old",
    session: { mode: "fresh", reason: "transcript_missing" },
  });
  reopened.close();
});
