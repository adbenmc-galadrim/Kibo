import { expect, test } from "bun:test";
import { ASK_TOOL, type HookEventName, type HookPayload, type RunEvent, type RunRecord } from "@kibo/schema";
import { initRun, reduceRun, runLabel } from "./run-machine";

const record: RunRecord = {
  id: "r1",
  seq: 41,
  projectId: "p1",
  ticketId: "t1",
  ticketKey: "KIB-14",
  ticketTitle: "Récepteur de hooks",
  profileId: "opus",
  profileName: "opus-dev",
  sessionId: "s1",
  brief: "",
  createdAt: 100,
};
const hook = (event: HookEventName, extra: Partial<HookPayload> = {}): RunEvent => ({
  type: "hook",
  payload: {
    event,
    sessionId: "s1",
    transcriptPath: "/tmp/s1.jsonl",
    tool: null,
    detail: null,
    question: null,
    agentId: null,
    ...extra,
  },
});
const exit = (code = 0, extra: Partial<Extract<RunEvent, { type: "exited" }>> = {}): RunEvent => ({
  type: "exited",
  code,
  isError: code !== 0,
  result: code === 0 ? "ok" : "boom",
  tokens: 100,
  costUsd: 0.01,
  denied: [],
  ...extra,
});
const spawned = (resume: boolean): RunEvent => ({
  type: "spawned",
  pid: 42,
  resume,
  workspace: "worktree:kib-14",
  guidelines: 3,
});
const running = () =>
  reduceRun(reduceRun(initRun(record, 5, 100), { type: "admitted", lane: 2 }, 110), spawned(false), 120);

test("labels carry the lane once admitted", () => {
  expect(runLabel("opus-dev", null)).toBe("opus-dev");
  expect(runLabel("opus-dev", 2)).toBe("opus-dev-2");
});

test("full cycle: queue, run, question, answer, resume, done", () => {
  let v = initRun(record, 5, 100);
  expect(v).toMatchObject({ state: "queued", label: "opus-dev", rank: 5, stateSince: 100 });
  v = reduceRun(v, { type: "admitted", lane: 2 }, 110);
  expect([v.state, v.label]).toEqual(["starting", "opus-dev-2"]);
  v = reduceRun(v, spawned(false), 120);
  expect(v).toMatchObject({
    state: "running",
    startedAt: 120,
    workspace: "worktree:kib-14",
    guidelines: 3,
    turns: 1,
  });
  v = reduceRun(v, hook("PostToolUse", { tool: ASK_TOOL, question: "Quel port pour le récepteur ?" }), 130);
  expect(v).toMatchObject({ state: "running", question: "Quel port pour le récepteur ?" });
  expect(v.lastActivity).toEqual({ at: 130, event: "PostToolUse", tool: ASK_TOOL, detail: null });
  v = reduceRun(v, exit(), 140);
  expect(v).toMatchObject({ state: "waiting_input", label: "opus-dev-2", tokens: 100 });
  v = reduceRun(v, { type: "answered", text: "Port dynamique", rank: -1 }, 150);
  expect(v).toMatchObject({
    state: "queued",
    lane: null,
    label: "opus-dev",
    priority: true,
    rank: -1,
    question: null,
    pendingAnswer: "Port dynamique",
  });
  v = reduceRun(v, { type: "admitted", lane: 1 }, 160);
  v = reduceRun(v, spawned(true), 170);
  expect(v).toMatchObject({ pendingAnswer: null, turns: 2, startedAt: 120 });
  v = reduceRun(v, exit(), 180);
  expect(v).toMatchObject({ state: "done", endedAt: 180, tokens: 200, costUsd: 0.02 });
});

test("a non-zero exit or an error result fails the run with its message", () => {
  expect(reduceRun(running(), exit(1), 200)).toMatchObject({ state: "failed", error: "boom", endedAt: 200 });
  const errored = reduceRun(running(), exit(0, { isError: true, result: "Invalid API key" }), 200);
  expect(errored).toMatchObject({ state: "failed", error: "Invalid API key" });
  const silent = reduceRun(running(), exit(137, { result: null }), 200);
  expect(silent.error).toBe("exit code 137");
});

test("denied tools and the captured output are kept", () => {
  expect(reduceRun(running(), exit(0, { denied: ["Write", "Bash"] }), 200).denied).toEqual(["Write", "Bash"]);
  expect(reduceRun(running(), exit(), 200).output).toBeNull();
  expect(reduceRun(running(), exit(0, { output: '{"type":"result"}' }), 200).output).toBe(
    '{"type":"result"}',
  );
});

test("a run without ticket follows the same cycle", () => {
  const task = initRun(
    { ...record, projectId: null, ticketId: null, ticketKey: null, ticketTitle: "Générer" },
    0,
    0,
  );
  const v = reduceRun(
    reduceRun(reduceRun(task, { type: "admitted", lane: 1 }, 1), spawned(false), 2),
    exit(),
    3,
  );
  expect(v).toMatchObject({ state: "done", ticketKey: null, ticketTitle: "Générer" });
});

test("illegal transitions throw INVALID_TRANSITION", () => {
  const queued = initRun(record, 0, 0);
  const done = reduceRun(running(), exit(), 200);
  expect(() => reduceRun(running(), { type: "answered", text: "x", rank: 0 }, 1)).toThrow(
    "INVALID_TRANSITION",
  );
  expect(() => reduceRun(running(), { type: "admitted", lane: 1 }, 1)).toThrow("INVALID_TRANSITION");
  expect(() => reduceRun(queued, spawned(false), 1)).toThrow("INVALID_TRANSITION");
  expect(() => reduceRun(done, { type: "cancelled" }, 1)).toThrow("INVALID_TRANSITION");
  expect(() => reduceRun(done, { type: "failed", error: "x" }, 1)).toThrow("INVALID_TRANSITION");
  expect(() => reduceRun(running(), { type: "reranked", rank: 0 }, 1)).toThrow("INVALID_TRANSITION");
  expect(() => reduceRun(running(), { type: "prioritized", priority: true }, 1)).toThrow(
    "INVALID_TRANSITION",
  );
  expect(() => reduceRun(queued, { type: "enqueued", rank: 0 }, 1)).toThrow("INVALID_TRANSITION");
});

test("a run cancelled while running stays cancelled when its process exits", () => {
  const cancelled = reduceRun(running(), { type: "cancelled" }, 200);
  const exited = reduceRun(cancelled, exit(143), 210);
  expect(exited).toMatchObject({ state: "cancelled", endedAt: 200, tokens: 100 });
});

test("hooks never change the state, even late ones", () => {
  const done = reduceRun(running(), exit(), 200);
  const late = reduceRun(done, hook("SessionEnd", { detail: "other" }), 210);
  expect(late.state).toBe("done");
  expect(late.lastActivity?.event).toBe("SessionEnd");
  const queued = reduceRun(initRun(record, 0, 0), hook("PostToolUse", { tool: ASK_TOOL, question: "?" }), 5);
  expect(queued).toMatchObject({ state: "queued", question: null });
});

test("sub-agents live inside their parent run", () => {
  let v = reduceRun(running(), hook("SubagentStart", { tool: "haiku-tests", agentId: "a1" }), 130);
  expect(v.subagents).toEqual([{ id: "a1", type: "haiku-tests", since: 130 }]);
  v = reduceRun(v, hook("SubagentStop", { tool: "haiku-tests", agentId: "a1" }), 140);
  expect(v.subagents).toEqual([]);
  v = reduceRun(v, hook("SubagentStart", { tool: null, agentId: "a2" }), 150);
  expect(reduceRun(v, exit(), 160).subagents).toEqual([]);
});
