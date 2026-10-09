import { expect, test } from "bun:test";
import { ASK_QUESTION_TOOL, ASK_TOOL } from "@kibo/schema";
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

const askInput = { question: "Bloquer le dépôt ?", options: ["Oui", "Non"], provisional: "Non" };

test("an ask_question call carries a non-blocking ask and no waiting question", () => {
  const p = reduceHookInput({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: ASK_QUESTION_TOOL,
    tool_input: { ...askInput, ticketId: "another" },
  });
  expect(p.question).toBeNull();
  expect(p.ask).toEqual({
    title: "Bloquer le dépôt ?",
    context: "",
    options: ["Oui", "Non"],
    provisional: "Non",
    blocking: false,
  });
});

test("an ask_user call carries its question and a blocking ask", () => {
  const p = reduceHookInput({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: ASK_TOOL,
    tool_input: { question: "Quel port ?", context: "# Détail" },
  });
  expect(p.question).toBe("Quel port ?");
  expect(p.ask).toEqual({
    title: "Quel port ?",
    context: "# Détail",
    options: [],
    provisional: null,
    blocking: true,
  });
});

test("no ask before the call nor for an invalid input, and huge inputs are cut", () => {
  const pre = reduceHookInput({
    ...base,
    hook_event_name: "PreToolUse",
    tool_name: ASK_QUESTION_TOOL,
    tool_input: askInput,
  });
  expect(pre.ask).toBeNull();
  const invalid = reduceHookInput({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: ASK_QUESTION_TOOL,
    tool_input: { ...askInput, provisional: "Peut-être" },
  });
  expect(invalid.ask).toBeNull();
  const huge = reduceHookPost({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: ASK_QUESTION_TOOL,
    tool_input: { question: "q".repeat(100_000), context: "c".repeat(100_000), provisional: "Non" },
  });
  expect(huge.payload.ask?.title).toHaveLength(200);
  expect(huge.payload.ask?.context).toHaveLength(8000);
  expect(JSON.stringify(huge).length).toBeLessThan(20_000);
});

const mcpDetail = (tool: string, input: Record<string, unknown>) =>
  reduceHookInput({
    ...base,
    hook_event_name: "PostToolUse",
    tool_name: `mcp__kibo__${tool}`,
    tool_input: input,
  }).detail;

test("project tool reads are summarized by what they target", () => {
  expect(mcpDetail("get_ticket", { key: "EMIS-11" })).toBe("EMIS-11");
  expect(mcpDetail("read_note", { path: "agent-de-projet/memoire.md" })).toBe("agent-de-projet/memoire.md");
  expect(mcpDetail("list_tickets", { status: "done", label: "x" })).toBe("status=done label=x");
  expect(mcpDetail("list_tickets", {})).toBeNull();
  expect(mcpDetail("list_tickets", { query: "SECRET", cursor: "50" })).toBeNull();
  expect(mcpDetail("list_questions", { state: "all", ticketKey: "EMIS-2" })).toBe(
    "state=all ticketKey=EMIS-2",
  );
  expect(mcpDetail("list_runs", { state: "running" })).toBe("state=running");
  expect(mcpDetail("project_overview", {})).toBeNull();
  expect(mcpDetail("list_notes", { cursor: "50" })).toBeNull();
});

test("a proposed batch is summarized by its size, never by its summary", () => {
  const actions = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const detail = mcpDetail("propose_batch", { summary: "SECRET plan", actions, path: "x.md" });
  expect(detail).toBe("3 actions");
  expect(mcpDetail("propose_batch", { summary: "SECRET plan" })).toBe("0 actions");
});
