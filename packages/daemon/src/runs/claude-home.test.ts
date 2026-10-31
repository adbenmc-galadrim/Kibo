import { expect, test } from "bun:test";
import { isClaudeIsolated } from "./claude-home";

test("claude runs isolated only when the daemon asks for it", () => {
  expect(isClaudeIsolated({ KIBO_CLAUDE_ISOLATED: "1" })).toBe(true);
  expect(isClaudeIsolated({})).toBe(false);
  expect(isClaudeIsolated({ KIBO_CLAUDE_ISOLATED: "0" })).toBe(false);
});
