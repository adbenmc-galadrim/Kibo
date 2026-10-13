import { expect, spyOn, test } from "bun:test";
import { type HookPayload, type HookReply, overlapStopReminder, type RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import type { HookSink } from "./hook-route";
import {
  PLAN_REMINDER,
  REPORT_REMINDER,
  REPORT_SKILLS_REMINDER,
  type ReminderDeps,
  SKILLS_REMINDER,
  withReminders,
} from "./reminders";

const hook = (event: HookPayload["event"], tool: string | null, stopHookActive = false): HookPayload => ({
  event,
  sessionId: "s",
  transcriptPath: null,
  tool,
  detail: null,
  question: null,
  agentId: null,
  toolUseId: null,
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

type Setup = {
  under?: HookReply | null;
  runs?: RunView[];
  plan?: boolean;
  report?: boolean;
  skills?: number;
  reviewed?: boolean;
  overlaps?: OpenOverlap[];
};

type OpenOverlap = { overlapId: string; ticketKey: string; label: string };

function setup({
  under = null,
  runs = [runView({ id: "r1" })],
  plan = false,
  report = false,
  skills = 0,
  reviewed = false,
  overlaps = [],
}: Setup = {}) {
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
    usedSkills: () => skills,
    hasSkillReview: () => reviewed,
    moment: (runId, kind) => moments.push(`${runId}:${kind}`),
    openDeliveredOverlaps: () => overlaps,
  };
  return { sink: withReminders(inner, deps), moments, received, overlaps };
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
      usedSkills: () => 0,
      hasSkillReview: () => false,
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

test("a failing plan, report or run lookup is logged and keeps the sink reply", () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  const boom = () => {
    throw new Error("store closed");
  };
  try {
    const allow: HookReply = { kind: "permission", decision: "allow", reason: "ok", additionalContext: null };
    const inner: HookSink = { verify: () => true, receive: (_, p) => (p.event === "Stop" ? null : allow) };
    const base: ReminderDeps = {
      run: () => runView({ id: "r1" }),
      hasPlan: () => false,
      hasReport: () => false,
      usedSkills: () => 0,
      hasSkillReview: () => false,
      moment: () => {},
    };
    expect(withReminders(inner, { ...base, hasPlan: boom }).receive("r1", edit, null)).toEqual(allow);
    expect(withReminders(inner, { ...base, hasReport: boom }).receive("r1", stop, null)).toBeNull();
    const lost = withReminders(inner, { ...base, run: boom });
    expect(lost.receive("r1", edit, null)).toEqual(allow);
    expect(lost.receive("r1", stop, null)).toBeNull();
    expect(errors).toHaveBeenCalledTimes(4);
  } finally {
    errors.mockRestore();
  }
});

test("a finished run is forgotten and a new turn of the same id is reminded again", () => {
  const { sink, moments } = setup();
  expect(sink.receive("r1", edit, null)).toEqual(planReminder);
  sink.forget("r1");
  expect(sink.receive("r1", edit, null)).toEqual(planReminder);
  expect(moments).toEqual(["r1:plan", "r1:plan"]);
});

test("a run that used a skill without review is reminded of it once at Stop", () => {
  const { sink, moments } = setup({ report: true, skills: 2 });
  expect(sink.receive("r1", stop, null)).toEqual({ kind: "stop", reason: SKILLS_REMINDER });
  expect(sink.receive("r1", stop, null)).toBeNull();
  expect(moments).toEqual(["r1:skills"]);
});

test("a missing report and a missing review give one combined reminder", () => {
  const { sink, moments } = setup({ skills: 1 });
  expect(sink.receive("r1", stop, null)).toEqual({ kind: "stop", reason: REPORT_SKILLS_REMINDER });
  expect(sink.receive("r1", stop, null)).toBeNull();
  expect(moments).toEqual(["r1:report_skills"]);
});

test("a run with its review, or without skill, keeps the report reminder alone", () => {
  const reviewed = setup({ skills: 1, reviewed: true });
  expect(reviewed.sink.receive("r1", stop, null)).toEqual(stopReminder);
  expect(reviewed.moments).toEqual(["r1:report"]);
  const done = setup({ report: true, skills: 1, reviewed: true });
  expect(done.sink.receive("r1", stop, null)).toBeNull();
  expect(done.moments).toEqual([]);
});

test("after the report reminder a later Stop is never blocked for the skills", () => {
  let skills = 0;
  const inner: HookSink = { verify: () => true, receive: () => null };
  const moments: string[] = [];
  const sink = withReminders(inner, {
    run: () => runView({ id: "r1" }),
    hasPlan: () => true,
    hasReport: () => skills > 0,
    usedSkills: () => skills,
    hasSkillReview: () => false,
    moment: (runId, kind) => moments.push(`${runId}:${kind}`),
  });
  expect(sink.receive("r1", stop, null)).toEqual(stopReminder);
  skills = 1;
  expect(sink.receive("r1", stop, null)).toBeNull();
  expect(moments).toEqual(["r1:report"]);
});

test("the plan reminder and the stop reminder are both given in the same run", () => {
  const { sink, moments } = setup({ skills: 1 });
  expect(sink.receive("r1", edit, null)).toEqual(planReminder);
  expect(sink.receive("r1", stop, null)).toEqual({ kind: "stop", reason: REPORT_SKILLS_REMINDER });
  expect(moments).toEqual(["r1:plan", "r1:report_skills"]);
});

test("a plan reminder joins the context already given by the guards", () => {
  const under: HookReply = { kind: "permission", decision: "allow", reason: "", additionalContext: "x" };
  const { sink } = setup({ under });
  expect(sink.receive("r1", edit, null)).toEqual({
    ...planReminder,
    additionalContext: `x\n\n${PLAN_REMINDER}`,
  });
});

const o1: OpenOverlap = { overlapId: "o1", ticketKey: "BOU-12", label: "`formatDate`" };
const o2: OpenOverlap = { overlapId: "o2", ticketKey: "BOU-12", label: "`src/i18n/fr.ts`" };

test("an open overlap delivered to the run blocks the Stop once, a new one blocks once more", () => {
  const { sink, moments, overlaps } = setup({ report: true, overlaps: [o1] });
  expect(sink.receive("r1", stop, null)).toEqual({ kind: "stop", reason: overlapStopReminder([o1]) });
  expect(sink.receive("r1", stop, null)).toBeNull();
  overlaps.push(o2);
  expect(sink.receive("r1", stop, null)).toEqual({ kind: "stop", reason: overlapStopReminder([o2]) });
  expect(sink.receive("r1", stop, null)).toBeNull();
  expect(moments).toEqual(["r1:overlap", "r1:overlap"]);
});

test("a Stop already continued by a hook is never blocked for an overlap", () => {
  const { sink, moments } = setup({ report: true, overlaps: [o1] });
  expect(sink.receive("r1", hook("Stop", null, true), null)).toBeNull();
  expect(moments).toEqual([]);
});

test("a missing report and an open overlap give one stop with both texts and two moments", () => {
  const { sink, moments } = setup({ overlaps: [o1] });
  expect(sink.receive("r1", stop, null)).toEqual({
    kind: "stop",
    reason: `${REPORT_REMINDER}\n\n${overlapStopReminder([o1])}`,
  });
  expect(sink.receive("r1", stop, null)).toBeNull();
  expect(moments).toEqual(["r1:report", "r1:overlap"]);
});

test("forget clears the overlaps already reminded", () => {
  const { sink, moments } = setup({ report: true, overlaps: [o1] });
  expect(sink.receive("r1", stop, null)).not.toBeNull();
  sink.forget("r1");
  expect(sink.receive("r1", stop, null)).toEqual({ kind: "stop", reason: overlapStopReminder([o1]) });
  expect(moments).toEqual(["r1:overlap", "r1:overlap"]);
});
