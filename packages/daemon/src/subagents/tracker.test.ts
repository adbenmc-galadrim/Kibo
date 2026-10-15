import { expect, test } from "bun:test";
import { CLAUDE_DENIAL_TEXT } from "../agents/fake-claude-transcript";
import { AGENT, hook, LAUNCH, META, RUN, TOOL_USE, tracked } from "./tracker.test-helper";

const LINE = '{"type":"assistant"}';

test("transcript before hook: one line keyed by the agent, linked to its tool use", () => {
  const { tracker, store, announced } = tracked();
  tracker.onLaunch(RUN, LAUNCH);
  tracker.onMeta(RUN, META);
  tracker.onSlice(RUN, AGENT, [LINE]);
  tracker.onHook(RUN, hook("SubagentStart"));
  const [only, ...rest] = store.list(RUN);
  expect(rest).toEqual([]);
  expect(only).toMatchObject({
    id: AGENT,
    toolUseId: TOOL_USE,
    type: "ecc:code-reviewer",
    prompt: "Relis le diff",
    state: "running",
    transcriptPath: "/p/s1/subagents/agent-a1.jsonl",
  });
  expect(announced).toEqual([
    {
      kind: "subagent",
      subagentId: AGENT,
      type: "ecc:code-reviewer",
      description: "Porte qualité — correctness",
    },
  ]);
});

test("hook before transcript: still one line", () => {
  const { tracker, store, announced } = tracked();
  tracker.onHook(RUN, hook("SubagentStart"));
  tracker.onLaunch(RUN, LAUNCH);
  tracker.onSlice(RUN, AGENT, [LINE]);
  tracker.onMeta(RUN, META);
  expect(store.list(RUN)).toHaveLength(1);
  expect(store.list(RUN)[0]).toMatchObject({ id: AGENT, toolUseId: TOOL_USE, prompt: "Relis le diff" });
  expect(announced).toHaveLength(1);
});

test("SubagentStop ends the subagent as done", () => {
  const { tracker, store } = tracked();
  tracker.onHook(RUN, hook("SubagentStart"));
  tracker.onHook(RUN, hook("SubagentStop"));
  expect(store.list(RUN)[0]).toMatchObject({ state: "done", endedAt: 1_000, result: "RAS" });
  expect(tracker.active(RUN)).toEqual([]);
});

test("a tool result in error fails the subagent, an async launch result does not end it", () => {
  const { tracker, store } = tracked();
  tracker.onLaunch(RUN, LAUNCH);
  tracker.onMeta(RUN, META);
  tracker.onResult(RUN, TOOL_USE, false, "Async agent launched successfully.");
  expect(tracker.active(RUN).map((s) => s.id)).toEqual([AGENT]);
  tracker.onResult(RUN, TOOL_USE, true, "boom");
  expect(store.list(RUN)[0]).toMatchObject({ state: "failed", result: "boom" });
});

test("a subagent launched by a subagent is attached to its parent", () => {
  const { tracker, store } = tracked();
  tracker.onMeta(RUN, META);
  tracker.onLaunch(RUN, { ...LAUNCH, toolUseId: "toolu_2", type: "Explore" }, AGENT);
  tracker.onMeta(RUN, { ...META, agentId: "a2", agentType: "Explore", toolUseId: "toolu_2", spawnDepth: 2 });
  expect(store.list(RUN).find((s) => s.id === "a2")).toMatchObject({ parentId: AGENT, type: "Explore" });
});

test("active lists only running subagents of the run", () => {
  const { tracker } = tracked();
  tracker.onHook(RUN, hook("SubagentStart", "a1"));
  tracker.onHook(RUN, hook("SubagentStart", "a2"));
  tracker.onHook(RUN, hook("SubagentStop", "a2"));
  tracker.onHook("r2", hook("SubagentStart", "a3"));
  expect(tracker.active(RUN).map((s) => s.id)).toEqual(["a1"]);
});

test("a launch never linked to an agent becomes a line keyed by its tool use when the run closes", () => {
  const { tracker, store, announced } = tracked();
  tracker.onLaunch(RUN, LAUNCH);
  tracker.onResult(RUN, TOOL_USE, false, "Terminé");
  expect(store.list(RUN)).toEqual([]);
  tracker.closeRun(RUN);
  expect(store.list(RUN)).toEqual([
    expect.objectContaining({
      id: TOOL_USE,
      toolUseId: TOOL_USE,
      state: "done",
      result: "Terminé",
      transcriptPath: null,
    }),
  ]);
  expect(announced.map((a) => a.subagentId)).toEqual([TOOL_USE]);
});

test("closing a run forgets the subagents it announced", () => {
  const { tracker, announced } = tracked();
  tracker.onLaunch(RUN, LAUNCH);
  tracker.onMeta(RUN, META);
  tracker.closeRun(RUN);
  tracker.onLaunch(RUN, LAUNCH);
  expect(announced.map((a) => a.subagentId)).toEqual([AGENT, AGENT]);
});

test("a launch refused by Kibo or by Claude Code never becomes a subagent line", () => {
  const refusals = [
    "Permission to use Agent has been denied. sous-agent non autorisé par Kibo : seo",
    CLAUDE_DENIAL_TEXT,
  ];
  for (const text of refusals) {
    const { tracker, store, announced } = tracked();
    tracker.onLaunch(RUN, LAUNCH);
    tracker.onResult(RUN, TOOL_USE, true, text);
    tracker.closeRun(RUN);
    expect(store.list(RUN)).toEqual([]);
    expect(announced).toEqual([]);
  }
});

test("a launch that failed for another reason still gets its line, failed", () => {
  const { tracker, store } = tracked();
  tracker.onLaunch(RUN, LAUNCH);
  tracker.onResult(RUN, TOOL_USE, true, "Agent crashed");
  tracker.closeRun(RUN);
  expect(store.list(RUN)).toEqual([expect.objectContaining({ id: TOOL_USE, state: "failed" })]);
});
