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
  resumedFrom: null,
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
    ask: null,
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
  cwd: "/repo/.kibo/worktrees/kib-14",
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
    cwd: "/repo/.kibo/worktrees/kib-14",
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
    question: "Quel port pour le récepteur ?",
    pendingAnswer: "Port dynamique",
  });
  v = reduceRun(v, { type: "admitted", lane: 1 }, 160);
  v = reduceRun(v, spawned(true), 170);
  expect(v).toMatchObject({ pendingAnswer: null, question: null, turns: 2, startedAt: 120 });
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

test("a ticket run that has started can be written to once it ended", () => {
  const ended = [
    reduceRun(running(), exit(), 200),
    reduceRun(running(), exit(1), 200),
    reduceRun(reduceRun(running(), { type: "cancelled" }, 200), exit(143), 210),
    reduceRun(running(), { type: "failed", error: "INTERRUPTED: restart" }, 200),
  ];
  for (const view of ended) {
    const next = reduceRun(
      { ...view, subagents: [{ id: "a1", type: "x", since: 1 }] },
      { type: "answered", text: "Encore une chose", rank: -3 },
      300,
    );
    expect(next).toMatchObject({
      state: "queued",
      stateSince: 300,
      lane: null,
      label: "opus-dev",
      priority: true,
      rank: -3,
      question: null,
      pendingAnswer: "Encore une chose",
      error: null,
      endedAt: null,
      subagents: [],
      startedAt: 120,
      tokens: view.tokens,
      turns: 1,
    });
  }
});

test("a run that never started or has no ticket cannot be written to once ended", () => {
  const answered: RunEvent = { type: "answered", text: "x", rank: 0 };
  const neverStarted = reduceRun(initRun(record, 0, 0), { type: "failed", error: "WORKSPACE_FAILED: x" }, 1);
  const cancelledInQueue = reduceRun(initRun(record, 0, 0), { type: "cancelled" }, 1);
  const task = initRun({ ...record, projectId: null, ticketId: null, ticketKey: null }, 0, 0);
  const taskDone = reduceRun(
    reduceRun(reduceRun(task, { type: "admitted", lane: 1 }, 1), spawned(false), 2),
    exit(),
    3,
  );
  for (const view of [neverStarted, cancelledInQueue, taskDone]) {
    expect(() => reduceRun(view, answered, 10)).toThrow("INVALID_TRANSITION");
  }
});

test("the active time sums the turns and leaves out the queue and the pause between them", () => {
  let v = running();
  expect(v).toMatchObject({ activeMs: 0, turnStartedAt: 120 });
  v = reduceRun(v, hook("PostToolUse", { tool: ASK_TOOL, question: "Quel port ?" }), 150);
  v = reduceRun(v, exit(), 200);
  expect(v).toMatchObject({ state: "waiting_input", activeMs: 80, turnStartedAt: null });
  v = reduceRun(v, { type: "answered", text: "4317", rank: 1 }, 5_000);
  expect(v).toMatchObject({ state: "queued", activeMs: 80, turnStartedAt: null });
  v = reduceRun(v, { type: "admitted", lane: 1 }, 6_000);
  v = reduceRun(v, spawned(true), 6_100);
  expect(v).toMatchObject({ activeMs: 80, turnStartedAt: 6_100 });
  v = reduceRun(v, exit(), 6_400);
  expect(v).toMatchObject({ state: "done", activeMs: 380, turnStartedAt: null });
});

test("a cancelled or failed turn counts up to its end; a turn that never spawned counts nothing", () => {
  expect(reduceRun(running(), { type: "cancelled" }, 170)).toMatchObject({
    activeMs: 50,
    turnStartedAt: null,
  });
  expect(reduceRun(running(), { type: "failed", error: "x" }, 180)).toMatchObject({
    activeMs: 60,
    turnStartedAt: null,
  });
  const starting = reduceRun(initRun(record, 5, 100), { type: "admitted", lane: 2 }, 110);
  expect(reduceRun(starting, { type: "failed", error: "x" }, 180)).toMatchObject({
    activeMs: 0,
    turnStartedAt: null,
  });
  expect(initRun(record, 5, 100)).toMatchObject({ activeMs: 0, turnStartedAt: null });
});

test("a message during a turn waits, joins the next one, and starts the next turn when the process exits", () => {
  let v = reduceRun(running(), { type: "answered", text: "Ajoute les tests", rank: 9 }, 130);
  expect(v).toMatchObject({ state: "running", pendingAnswer: "Ajoute les tests", rank: 5, priority: false });
  v = reduceRun(v, { type: "answered", text: "Et la doc.", rank: 9 }, 140);
  expect(v.pendingAnswer).toBe("Ajoute les tests\n\nEt la doc.");
  v = reduceRun(v, exit(), 200);
  expect(v).toMatchObject({ state: "done", pendingAnswer: "Ajoute les tests\n\nEt la doc.", endedAt: 200 });
  v = reduceRun(v, { type: "requeued", rank: 1 }, 201);
  expect(v).toMatchObject({
    state: "queued",
    priority: true,
    rank: 1,
    endedAt: null,
    error: null,
    lane: null,
  });
  expect(v.pendingAnswer).toBe("Ajoute les tests\n\nEt la doc.");
  v = reduceRun(reduceRun(v, { type: "admitted", lane: 1 }, 210), spawned(true), 220);
  expect(v).toMatchObject({ state: "running", pendingAnswer: null, turns: 2 });
});

test("a message answers a question asked after it, and a queued first turn keeps its message", () => {
  let v = reduceRun(running(), { type: "answered", text: "Vas-y", rank: 9 }, 130);
  v = reduceRun(v, hook("PostToolUse", { tool: ASK_TOOL, question: "Je continue ?" }), 140);
  v = reduceRun(v, exit(), 150);
  expect(v).toMatchObject({ state: "waiting_input", pendingAnswer: "Vas-y" });
  expect(reduceRun(v, { type: "requeued", rank: 1 }, 151)).toMatchObject({
    state: "queued",
    question: "Je continue ?",
  });
  const queued = reduceRun(initRun(record, 5, 100), { type: "answered", text: "Précision", rank: 9 }, 101);
  expect(queued).toMatchObject({ state: "queued", rank: 5, pendingAnswer: "Précision", turns: 0 });
});

test("cancelling or failing drops the waiting message; requeued needs one", () => {
  const withMessage = reduceRun(running(), { type: "answered", text: "x", rank: 9 }, 130);
  expect(reduceRun(withMessage, { type: "cancelled" }, 140).pendingAnswer).toBeNull();
  expect(
    reduceRun(withMessage, { type: "failed", error: "INTERRUPTED: restart" }, 140).pendingAnswer,
  ).toBeNull();
  const done = reduceRun(running(), exit(), 200);
  expect(() => reduceRun(done, { type: "requeued", rank: 1 }, 201)).toThrow("INVALID_TRANSITION");
  expect(() => reduceRun(withMessage, { type: "requeued", rank: 1 }, 131)).toThrow("INVALID_TRANSITION");
  const failedExit = reduceRun(withMessage, exit(1), 200);
  expect(reduceRun(failedExit, { type: "requeued", rank: 1 }, 201)).toMatchObject({
    state: "queued",
    error: null,
  });
});

test("a run without ticket still only answers a question", () => {
  const task = { ...record, projectId: null, ticketId: null, ticketKey: null };
  const v = reduceRun(
    reduceRun(initRun(task, 5, 100), { type: "admitted", lane: 1 }, 110),
    spawned(false),
    120,
  );
  expect(() => reduceRun(v, { type: "answered", text: "x", rank: 1 }, 130)).toThrow("INVALID_TRANSITION");
});

test("the question stays on the run until the next turn starts, so the queue can tell an answer from a message", () => {
  let v = reduceRun(running(), hook("PostToolUse", { tool: ASK_TOOL, question: "Quel port ?" }), 150);
  v = reduceRun(v, exit(), 200);
  v = reduceRun(v, { type: "answered", text: "4317", rank: 1 }, 300);
  expect(v).toMatchObject({ state: "queued", question: "Quel port ?", pendingAnswer: "4317" });
  v = reduceRun(reduceRun(v, { type: "admitted", lane: 1 }, 310), spawned(true), 320);
  expect(v).toMatchObject({ state: "running", question: null, pendingAnswer: null, turns: 2 });
  expect(reduceRun(v, exit(), 400).state).toBe("done");
  const finished = reduceRun(running(), exit(), 200);
  expect(reduceRun(finished, { type: "answered", text: "Ajoute la doc", rank: 1 }, 300)).toMatchObject({
    state: "queued",
    question: null,
    pendingAnswer: "Ajoute la doc",
  });
  const asked = reduceRun(
    reduceRun(running(), { type: "answered", text: "Vas-y", rank: 9 }, 130),
    hook("PostToolUse", { tool: ASK_TOOL, question: "Je continue ?" }),
    140,
  );
  const requeued = reduceRun(reduceRun(asked, exit(), 150), { type: "requeued", rank: 1 }, 151);
  expect(requeued).toMatchObject({ state: "queued", question: "Je continue ?", pendingAnswer: "Vas-y" });
});

test("a setup step is journaled while starting and changes nothing else", () => {
  const starting = reduceRun(initRun(record, 5, 100), { type: "admitted", lane: 2 }, 110);
  const step: RunEvent = { type: "setup", command: "pnpm worktree kib-14", status: "running" };
  expect(reduceRun(starting, step, 130)).toEqual(starting);
  expect(() => reduceRun(running(), step, 130)).toThrow("INVALID_TRANSITION");
});

test("the session decision is journaled while starting and sets the run session only", () => {
  const starting = reduceRun(initRun(record, 5, 100), { type: "admitted", lane: 2 }, 110);
  expect(starting.session).toBeNull();
  const fresh: RunEvent = { type: "session", mode: "fresh", reason: "transcript_missing" };
  expect(reduceRun(starting, fresh, 115)).toEqual({
    ...starting,
    session: { mode: "fresh", reason: "transcript_missing" },
  });
  const resumed = reduceRun(starting, { type: "session", mode: "resumed", from: "r0" }, 115);
  expect(resumed.session).toEqual({ mode: "resumed", from: "r0" });
  expect(() => reduceRun(running(), fresh, 130)).toThrow("INVALID_TRANSITION");
});

test("spawned replaces the session id only when it carries one", () => {
  const starting = reduceRun(initRun(record, 5, 100), { type: "admitted", lane: 2 }, 110);
  const withId: RunEvent = {
    type: "spawned",
    pid: 42,
    resume: false,
    workspace: "w",
    guidelines: 0,
    sessionId: "new",
  };
  expect(reduceRun(starting, withId, 120).sessionId).toBe("new");
  expect(reduceRun(starting, spawned(false), 120).sessionId).toBe("s1");
});
