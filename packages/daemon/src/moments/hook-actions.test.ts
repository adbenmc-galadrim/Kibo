import { expect, test } from "bun:test";
import { type HookPayload, hasSecret, MASKED, SKILL_REVIEW_TOOL } from "@kibo/schema";
import { actionFromHook } from "./hook-actions";

const hook = (p: Partial<HookPayload>): HookPayload => ({
  event: "PostToolUse",
  sessionId: "s1",
  transcriptPath: null,
  tool: null,
  detail: null,
  question: null,
  agentId: null,
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
  ...p,
});

test("a PostToolUse becomes an action in plain French", () => {
  expect(actionFromHook(hook({ tool: "Edit", detail: "src/a.ts" }))).toEqual({
    tool: "Edit",
    kind: "edit",
    label: "A modifié `a.ts`",
    target: "src/a.ts",
    outcome: "ok",
    detail: null,
    patch: null,
    tests: null,
  });
  expect(actionFromHook(hook({ tool: "Bash", detail: "bun test" }))).toMatchObject({
    kind: "test",
    target: "bun test",
  });
  expect(actionFromHook(hook({ tool: "Grep", detail: "LoginForm" }))).toMatchObject({
    kind: "search",
    target: "LoginForm",
  });
  expect(actionFromHook(hook({ tool: "TodoWrite" }))).toMatchObject({ kind: "todo", target: null });
});

test("other events are not actions", () => {
  expect(actionFromHook(hook({ event: "PreToolUse", tool: "Edit", detail: "src/a.ts" }))).toBeNull();
  expect(actionFromHook(hook({ event: "Stop", detail: "Fini." }))).toBeNull();
  expect(actionFromHook(hook({ tool: null }))).toBeNull();
});

test("a secret in the hook detail is masked everywhere", () => {
  const action = actionFromHook(
    hook({ tool: "Bash", detail: "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123 gh pr list" }),
  );
  expect(action?.target).toContain(MASKED);
  expect([action?.label, action?.target].some((t) => hasSecret(t ?? ""))).toBe(false);
  const long = actionFromHook(hook({ tool: "Bash", detail: `${"x ".repeat(55)}API_KEY=abcdefghijklmnop` }));
  expect([long?.label, long?.target].some((t) => hasSecret(t ?? ""))).toBe(false);
});

test("a PostToolUse of Skill is a skill action identified by its tool use id", () => {
  expect(
    actionFromHook(hook({ tool: "Skill", detail: "brainstorming", toolUseId: "toolu_1" })),
  ).toMatchObject({
    tool: "Skill",
    kind: "skill",
    target: "brainstorming",
    label: "A utilisé le skill `brainstorming`",
    callId: "toolu_1",
  });
  expect(actionFromHook(hook({ tool: "Skill" }))).toMatchObject({
    kind: "skill",
    label: "A utilisé un skill",
  });
  expect(actionFromHook(hook({ tool: "Read", detail: "a.ts" }))?.callId).toBeUndefined();
  expect(actionFromHook(hook({ tool: "Read", toolUseId: "x".repeat(65) }))?.callId).toBeUndefined();
});

test("a skill review after the call is labelled with the number of reviewed skills", () => {
  const action = actionFromHook(hook({ tool: SKILL_REVIEW_TOOL, detail: "2 skills" }));
  expect(action?.label).toBe("A laissé une review de 2 skills");
  expect(actionFromHook(hook({ tool: SKILL_REVIEW_TOOL }))?.label).toBe("A laissé une review des skills");
});
