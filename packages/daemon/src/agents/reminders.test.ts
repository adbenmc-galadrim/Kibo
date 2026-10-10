import { expect, spyOn, test } from "bun:test";
import type { HookPayload, HookReply, RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import type { HookSink } from "./hook-route";
import { PLAN_REMINDER, REPORT_REMINDER, type ReminderDeps, withReminders } from "./reminders";

const hook = (event: HookPayload["event"], tool: string | null, stopHookActive = false): HookPayload => ({
  event,
  sessionId: "s",
  transcriptPath: null,
  tool,
  detail: null,
  question: null,
  agentId: null,
  ask: null,
  todos: null,
  stopHookActive,
});
const edit = hook("PreToolUse", "Edit");
const stop = hook("Stop", null);
const planReminder: HookReply = {
  kind: "permission",
  decision: "allow",
  reason: "",
  additionalContext: PLAN_REMINDER,
};
const stopReminder: HookReply = { kind: "stop", reason: REPORT_REMINDER };

type Setup = { under?: HookReply | null; runs?: RunView[]; plan?: boolean; report?: boolean };

function setup({ under = null, runs = [runView({ id: "r1" })], plan = false, report = false }: Setup = {}) {
  const moments: string[] = [];
  const received: string[] = [];
  const inner: HookSink = {
    verify: (runId) => runId === "r1",
    receive: (runId, payload) => {
      received.push(`${runId}:${payload.event}`);
      return under;
    },
  };
  const deps: ReminderDeps = {
    run: (runId) => runs.find((r) => r.id === runId) ?? null,
    hasPlan: () => plan,
    hasReport: () => report,
    moment: (runId, kind) => moments.push(`${runId}:${kind}`),
  };
  return { sink: withReminders(inner, deps), moments, received };
}

test("the first modification of a ticket run without a plan is allowed with the plan reminder, once", () => {
  const { sink, moments, received } = setup();
  expect(sink.verify("r1", "t")).toBe(true);
  expect(sink.receive("r1", edit, null)).toEqual(planReminder);
  expect(sink.receive("r1", edit, null)).toBeNull();
  expect(sink.receive("r1", hook("PreToolUse", "Write"), null)).toBeNull();
  expect(moments).toEqual(["r1:plan"]);
  expect(received).toEqual(["r1:PreToolUse", "r1:PreToolUse", "r1:PreToolUse"]);
});

test("every modifying tool triggers the reminder, a read never does", () => {
  for (const tool of ["Edit", "Write", "MultiEdit", "NotebookEdit"]) {
    expect(setup().sink.receive("r1", hook("PreToolUse", tool), null)).toEqual(planReminder);
  }
  const { sink, moments } = setup();
  expect(sink.receive("r1", hook("PreToolUse", "Read"), null)).toBeNull();
  expect(sink.receive("r1", hook("PostToolUse", "Edit"), null)).toBeNull();
  expect(moments).toEqual([]);
});

test("a run with a plan is never reminded of it", () => {
  const { sink, moments } = setup({ plan: true });
  expect(sink.receive("r1", edit, null)).toBeNull();
  expect(moments).toEqual([]);
});

test("a deny of the guards wins over the reminder, an allow keeps its reason", () => {
  const deny: HookReply = { kind: "permission", decision: "deny", reason: "non", additionalContext: null };
  const denied = setup({ under: deny });
  expect(denied.sink.receive("r1", edit, null)).toEqual(deny);
  expect(denied.moments).toEqual([]);
  const allow: HookReply = { kind: "permission", decision: "allow", reason: "task", additionalContext: null };
  const allowed = setup({ under: allow });
  expect(allowed.sink.receive("r1", edit, null)).toEqual({ ...planReminder, reason: "task" });
  expect(allowed.moments).toEqual(["r1:plan"]);
});

test("the first Stop without a report asks for it once; the next Stop always passes", () => {
  const { sink, moments } = setup();
  expect(sink.receive("r1", stop, null)).toEqual(stopReminder);
  expect(sink.receive("r1", stop, null)).toBeNull();
  expect(moments).toEqual(["r1:report"]);
});

test("a Stop already continued by a hook, or a run with a report, is never blocked", () => {
  const active = setup();
  expect(active.sink.receive("r1", hook("Stop", null, true), null)).toBeNull();
  expect(active.moments).toEqual([]);
  const reported = setup({ report: true });
  expect(reported.sink.receive("r1", stop, null)).toBeNull();
  expect(reported.moments).toEqual([]);
});

test("a project run and an unknown run are never reminded and keep the sink reply", () => {
  const deny: HookReply = {
    kind: "permission",
    decision: "deny",
    reason: "lecture",
    additionalContext: null,
  };
  const project = setup({ runs: [runView({ id: "r1", kind: "project" })] });
  expect(project.sink.receive("r1", edit, null)).toBeNull();
  expect(project.sink.receive("r1", stop, null)).toBeNull();
  const unknown = setup({ under: deny, runs: [] });
  expect(unknown.sink.receive("r1", edit, null)).toEqual(deny);
  expect(unknown.sink.receive("r1", stop, null)).toEqual(deny);
  expect([...project.moments, ...unknown.moments]).toEqual([]);
});

test("each run is reminded on its own", () => {
  const { sink, moments } = setup({ runs: [runView({ id: "r1" }), runView({ id: "r2" })] });
  expect(sink.receive("r1", edit, null)).toEqual(planReminder);
  expect(sink.receive("r2", edit, null)).toEqual(planReminder);
  expect(moments).toEqual(["r1:plan", "r2:plan"]);
});

test("a failing moment is logged and never turns the reminder into a refusal", () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const inner: HookSink = { verify: () => true, receive: () => null };
    const sink = withReminders(inner, {
      run: () => runView({ id: "r1" }),
      hasPlan: () => false,
      hasReport: () => false,
      moment: () => {
        throw new Error("disk full");
      },
    });
    expect(sink.receive("r1", edit, null)).toEqual(planReminder);
    expect(errors).toHaveBeenCalledTimes(1);
  } finally {
    errors.mockRestore();
  }
});
