import { expect, test } from "bun:test";
import { ASK_TOOL } from "@kibo/schema";
import { clipToolInput, reduceHookInput, reduceHookPost } from "./hook-payload";

const base = { session_id: "s1", transcript_path: "/t/s1.jsonl", cwd: "/w", permission_mode: "default" };

test("keeps only what Kibo needs from a tool event", () => {
  const p = reduceHookInput({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: "Write",
    tool_input: { file_path: "src/hooks/receiver.ts", content: "SECRET".repeat(1000) },
    tool_result: [{ type: "text", text: "big" }],
  });
  expect(p).toEqual({
    event: "PostToolUse",
    sessionId: "s1",
    transcriptPath: "/t/s1.jsonl",
    tool: "Write",
    detail: "src/hooks/receiver.ts",
    question: null,
    agentId: null,
    ask: null,
  });
});

test("a Bash call is summarized by its command, clipped", () => {
  const p = reduceHookInput({
    ...base,
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "x".repeat(5000) },
  });
  expect(p.detail?.length).toBe(2000);
});

test("extracts the question of the Kibo ask tool", () => {
  const p = reduceHookInput({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: ASK_TOOL,
    tool_input: { question: "Quel port pour le récepteur ?" },
  });
  expect(p.question).toBe("Quel port pour le récepteur ?");
  const pre = reduceHookInput({
    ...base,
    hook_event_name: "PreToolUse",
    tool_name: ASK_TOOL,
    tool_input: { question: "?" },
  });
  expect(pre.question).toBeNull();
});

test("sub-agent events carry the agent type and id; null fields are accepted", () => {
  const p = reduceHookInput({
    ...base,
    hook_event_name: "SubagentStart",
    agent_id: "a1",
    agent_type: "haiku-tests",
    tool_name: null,
  });
  expect(p).toMatchObject({ event: "SubagentStart", tool: "haiku-tests", agentId: "a1", detail: null });
  expect(
    reduceHookInput({ ...base, hook_event_name: "SessionStart", source: "startup", agent_id: null }).detail,
  ).toBe("startup");
});

test("an unknown event or a non-object is refused", () => {
  expect(() => reduceHookInput({ ...base, hook_event_name: "UserPromptSubmit" })).toThrow("INVALID_INPUT");
  expect(() => reduceHookInput("hello")).toThrow("INVALID_INPUT");
});

test("tool inputs are clipped before leaving the agent", () => {
  const clipped = clipToolInput({ content: "x".repeat(10_000), deep: { a: { b: 1 } }, list: ["a", ["b"]] });
  expect(String(clipped?.content).length).toBe(2000);
  expect(clipped?.deep).toEqual({ a: null });
  expect(clipped?.list).toEqual(["a", null]);
  expect(clipToolInput(null)).toBeNull();
  expect(
    Object.keys(clipToolInput(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]))) ?? {}),
  ).toHaveLength(20);
});

test("only a PreToolUse carries its tool input to the daemon", () => {
  const pre = reduceHookPost({
    ...base,
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "ls" },
  });
  expect(pre.toolInput).toEqual({ command: "ls" });
  const after = reduceHookPost({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "ls" },
  });
  expect(after.toolInput).toBeNull();
});
