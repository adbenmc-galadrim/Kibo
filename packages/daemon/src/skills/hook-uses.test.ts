import { expect, spyOn, test } from "bun:test";
import type { HookPayload, HookReply, RunAction } from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import { withSkillUses } from "./hook-uses";

const hook = (p: Partial<HookPayload>): HookPayload => ({
  event: "PostToolUse",
  sessionId: "s",
  transcriptPath: null,
  tool: "Skill",
  detail: "brainstorming",
  question: null,
  agentId: null,
  toolUseId: "toolu_1",
  ask: null,
  todos: null,
  stopHookActive: false,
  ...p,
});

function rig(reply: HookReply | null = null, fail = false) {
  const recorded: { runId: string; actions: readonly RunAction[]; at: number }[] = [];
  const inner: HookSink = { verify: (runId) => runId === "r1", receive: () => reply };
  const sink = withSkillUses(inner, {
    record: (runId, actions, at) => {
      if (fail) throw new Error("db closed");
      recorded.push({ runId, actions, at });
    },
    now: () => 7,
  });
  return { sink, recorded };
}

test("a PostToolUse of Skill with its tool use id is recorded at once, the reply is kept", () => {
  const deny: HookReply = { kind: "permission", decision: "deny", reason: "x", additionalContext: null };
  const { sink, recorded } = rig(deny);
  expect(sink.verify("r1", "t")).toBe(true);
  expect(sink.receive("r1", hook({}), null)).toEqual(deny);
  expect(recorded).toEqual([
    {
      runId: "r1",
      actions: [expect.objectContaining({ kind: "skill", target: "brainstorming", callId: "toolu_1" })],
      at: 7,
    },
  ]);
});

test("other hooks, and a Skill hook without tool use id, are left to the transcript", () => {
  const { sink, recorded } = rig();
  sink.receive("r1", hook({ event: "PreToolUse" }), null);
  sink.receive("r1", hook({ tool: "Read", detail: "a.ts" }), null);
  sink.receive("r1", hook({ toolUseId: null }), null);
  expect(recorded).toEqual([]);
});

test("a failing record is logged and never changes the reply", () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const { sink } = rig(null, true);
    expect(sink.receive("r1", hook({}), null)).toBeNull();
    expect(errors).toHaveBeenCalledTimes(1);
  } finally {
    errors.mockRestore();
  }
});
