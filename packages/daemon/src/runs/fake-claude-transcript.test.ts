import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isClaudeDenial } from "@kibo/schema";
import { cleanFakeDirs, finish, readHooks, settings, start, tmp } from "./fake-claude.test-helper";
import { FakeScenario, scenarioPath } from "./fake-claude-scenario";
import {
  CLAUDE_DENIAL_TEXT,
  denialOutcome,
  hookExtra,
  hookOutcome,
  type LineContext,
  mcpOutcome,
  openTranscript,
  structuredPatch,
  textLine,
  thinkingLine,
  toolResultLine,
  toolTrail,
  toolUseLine,
} from "./fake-claude-transcript";
import { transcriptTokens } from "./transcript";

cleanFakeDirs();

const ctx: LineContext = {
  sessionId: "s1",
  cwd: "/repo",
  parentUuid: "p0",
  at: new Date(Date.UTC(2026, 9, 10)),
};
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const lines = (path: string) =>
  readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as Record<string, unknown>);

test("assistant lines carry text, thinking and tool_use blocks in the Claude Code format", () => {
  const text = textLine(ctx, "Je lis le formulaire.");
  expect(text).toMatchObject({
    type: "assistant",
    parentUuid: "p0",
    isSidechain: false,
    sessionId: "s1",
    cwd: "/repo",
    timestamp: "2026-10-10T00:00:00.000Z",
    message: { role: "assistant", content: [{ type: "text", text: "Je lis le formulaire." }] },
  });
  expect(text.message.usage).toBeUndefined();
  expect(text.uuid).toMatch(/^[0-9a-f-]{36}$/);
  expect(thinkingLine(ctx, "Hmm").message.content).toEqual([
    { type: "thinking", thinking: "Hmm", signature: "fake" },
  ]);
  expect(toolUseLine(ctx, "toolu_1", "Read", { file_path: "a.ts" }).message.content).toEqual([
    { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: "a.ts" } },
  ]);
  expect(textLine(ctx, "fin", { input_tokens: 1, output_tokens: 2 }).message.usage).toEqual({
    input_tokens: 1,
    output_tokens: 2,
  });
});

test("a tool result is a user line with tool_result, is_error only on failure, and toolUseResult", () => {
  const ok = toolResultLine(ctx, "toolu_1", { content: "ok", isError: false, toolUseResult: { a: 1 } });
  expect(ok).toMatchObject({
    type: "user",
    message: { role: "user", content: [{ tool_use_id: "toolu_1", type: "tool_result", content: "ok" }] },
    toolUseResult: { a: 1 },
  });
  const failed = toolResultLine(ctx, "toolu_2", { content: "Exit code 1", isError: true });
  expect(failed.message.content).toEqual([
    { tool_use_id: "toolu_2", type: "tool_result", content: "Exit code 1", is_error: true },
  ]);
  expect("toolUseResult" in failed).toBe(false);
});

test("a hook step outcome derives the structured patch, the error flag and the response", () => {
  const edit = hookOutcome(
    { tool_response: "ok", patch: { added: 8, removed: 3 } },
    { file_path: "src/a.ts" },
  );
  expect(edit.content).toBe("ok");
  expect(edit.isError).toBe(false);
  expect(edit.toolUseResult).toEqual({
    filePath: "src/a.ts",
    structuredPatch: structuredPatch({ added: 8, removed: 3 }),
  });
  const [hunk] = structuredPatch({ added: 8, removed: 3 });
  expect(hunk?.lines.filter((l) => l.startsWith("+"))).toHaveLength(8);
  expect(hunk?.lines.filter((l) => l.startsWith("-"))).toHaveLength(3);
  const bash = hookOutcome({ tool_response: "Exit code 1\n 12 pass\n 1 fail", is_error: true }, {});
  expect(bash).toEqual({
    content: "Exit code 1\n 12 pass\n 1 fail",
    isError: true,
    toolUseResult: "Exit code 1\n 12 pass\n 1 fail",
  });
  expect(hookOutcome({ tool_response: { stdout: "x" } }, {}).content).toBe('{"stdout":"x"}');
  expect(hookOutcome({}, {}).content).toBe('"ok"');
  expect(hookExtra({ tool_response: "ok", patch: {}, is_error: true })).toEqual({ tool_response: "ok" });
  expect(hookExtra(undefined)).toEqual({});
  expect(denialOutcome("Edit")).toEqual({
    content: "Permission to use Edit has been denied.",
    isError: true,
  });
  expect(mcpOutcome("Plan enregistré.", false)).toEqual({
    content: [{ type: "text", text: "Plan enregistré." }],
    isError: false,
    toolUseResult: [{ type: "text", text: "Plan enregistré." }],
  });
});

test("an open transcript chains uuids, continues an existing file and appends raw lines as they are", () => {
  const path = join(tmp(), "s1.jsonl");
  const first = openTranscript(path, "s1", "/repo");
  first.user("Lis le brief.");
  first.say("Je lis.");
  const second = openTranscript(path, "s1", "/repo");
  second.think("Hmm");
  second.raw("pas du JSON");
  second.say("Fin.", { input_tokens: 600, output_tokens: 600 });
  const got = readFileSync(path, "utf8").trim().split("\n");
  expect(got[3]).toBe("pas du JSON");
  const parsed = [0, 1, 2, 4].map((i) => JSON.parse(got[i] ?? "{}") as Record<string, unknown>);
  expect(parsed.map((l) => l.type)).toEqual(["user", "assistant", "assistant", "assistant"]);
  expect(parsed[0]?.parentUuid).toBeNull();
  expect(parsed[1]?.parentUuid).toBe(parsed[0]?.uuid);
  expect(parsed[2]?.parentUuid).toBe(parsed[1]?.uuid);
  expect(parsed[3]?.parentUuid).toBe(parsed[2]?.uuid);
  expect(parsed.every((l) => ISO.test(String(l.timestamp)))).toBe(true);
  expect(transcriptTokens(readFileSync(path, "utf8"))).toBe(1200);
});

test("a tool trail pairs a PreToolUse with its result and records denials", () => {
  const path = join(tmp(), "s2.jsonl");
  const trail = toolTrail(openTranscript(path, "s2", "/repo"));
  trail.before("Edit", { file_path: "a.ts" });
  trail.after("Edit", { file_path: "a.ts" }, { content: "ok", isError: false });
  trail.after("Read", { file_path: "b.ts" }, { content: "b", isError: false });
  trail.before("Write", { file_path: "c.ts" });
  trail.denied("Write");
  trail.denied("Bash");
  const got = lines(path);
  const blocks = got.map((l) => {
    const content = (l.message as { content: Array<Record<string, unknown>> }).content;
    return content[0] ?? {};
  });
  expect(blocks.map((b) => [b.type, b.name ?? null])).toEqual([
    ["tool_use", "Edit"],
    ["tool_result", null],
    ["tool_use", "Read"],
    ["tool_result", null],
    ["tool_use", "Write"],
    ["tool_result", null],
  ]);
  expect(blocks[1]?.tool_use_id).toBe(blocks[0]?.id);
  expect(blocks[3]?.tool_use_id).toBe(blocks[2]?.id);
  expect(blocks[5]).toMatchObject({ tool_use_id: blocks[4]?.id, is_error: true });
});

test("a broken last line restarts the chain", () => {
  const path = join(tmp(), "s3.jsonl");
  writeFileSync(path, "{tronqué\n");
  openTranscript(path, "s3", "/repo").say("Reprise.");
  const last = readFileSync(path, "utf8").trim().split("\n").at(-1) ?? "{}";
  expect((JSON.parse(last) as { parentUuid: unknown }).parentUuid).toBeNull();
});

const contentOf = (line: Record<string, unknown>): Array<Record<string, unknown>> => {
  const content = (line.message as { content: unknown }).content;
  return Array.isArray(content) ? content : [];
};

test("a tool refused by Claude Code gets the no-approval-surface result", () => {
  const path = join(tmp(), "s4.jsonl");
  const trail = toolTrail(openTranscript(path, "s4", "/repo"));
  trail.before("Bash", { command: "pnpm test" });
  trail.claudeDenied("Bash");
  const [use, result] = lines(path).map((l) => contentOf(l)[0] ?? {});
  expect(use).toMatchObject({ type: "tool_use", name: "Bash", input: { command: "pnpm test" } });
  expect(result).toMatchObject({ tool_use_id: use?.id, is_error: true, content: CLAUDE_DENIAL_TEXT });
  expect(CLAUDE_DENIAL_TEXT.startsWith("Permission for this tool use was denied.")).toBe(true);
  expect(isClaudeDenial(CLAUDE_DENIAL_TEXT)).toBe(true);
});

function withoutMcp(dir: string): string {
  const scenario = FakeScenario.parse(JSON.parse(readFileSync(scenarioPath("delivery-denied"), "utf8")));
  const turns = scenario.turns.map((t) => ({ ...t, steps: t.steps.filter((step) => !("mcp" in step)) }));
  const file = join(dir, "delivery-denied.json");
  writeFileSync(file, JSON.stringify({ turns }));
  return file;
}

test("the delivery-denied scenario plays Claude Code refusals then resumes", async () => {
  const state = tmp();
  const log = join(state, "hooks.jsonl");
  const env = { KIBO_FAKE_CLAUDE_SCENARIO: withoutMcp(state), KIBO_FAKE_CLAUDE_STATE: state };
  const first = await finish(start(["--session-id", "s5", "--settings", settings(log)], env));
  expect(first.code).toBe(0);
  expect(first.lines.at(-1)?.permission_denials).toEqual([
    { tool_name: "Bash" },
    { tool_name: "Read" },
    { tool_name: "Bash" },
  ]);
  const results = lines(join(state, "s5.jsonl"))
    .flatMap(contentOf)
    .filter((b) => b.type === "tool_result" && b.is_error === true);
  expect(results).toHaveLength(3);
  expect(results.every((b) => b.content === CLAUDE_DENIAL_TEXT)).toBe(true);
  const hooks = readHooks(log);
  expect(hooks.filter((h) => h.hook_event_name === "PreToolUse").map((h) => h.tool_input)).toEqual([
    { command: "pnpm test" },
    { file_path: "~/.claude/skills/full-delivery/reference/kibo.md" },
    { command: 'sh -c "rm -rf x"' },
  ]);
  expect(hooks.filter((h) => h.hook_event_name === "PostToolUse")).toEqual([]);
  const second = await finish(start(["--resume", "s5", "--settings", settings(log)], env, "Reprends."));
  expect(second.code).toBe(0);
  expect(second.lines.at(-1)?.permission_denials).toEqual([]);
  const resumed = readHooks(log).filter((h) => h.hook_event_name === "PostToolUse");
  expect(resumed.map((h) => h.tool_input)).toEqual([{ command: "echo resumed" }]);
});
