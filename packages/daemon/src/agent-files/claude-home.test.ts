import { expect, test } from "bun:test";
import { claudeHomeOf, isClaudeIsolated, pluginsRootOf } from "./claude-home";

test("the Claude home follows CLAUDE_CONFIG_DIR, else ~/.claude", () => {
  expect(claudeHomeOf({ CLAUDE_CONFIG_DIR: "/x" }, "/h", "/k")).toBe("/x");
  expect(claudeHomeOf({}, "/h", "/k")).toBe("/h/.claude");
  expect(claudeHomeOf({ CLAUDE_CONFIG_DIR: "" }, "/h", "/k")).toBe("/h/.claude");
});

test("an isolated daemon keeps its agents and skills under its own home", () => {
  expect(claudeHomeOf({ KIBO_CLAUDE_ISOLATED: "1" }, "/h", "/k")).toBe("/k/claude");
  expect(claudeHomeOf({ KIBO_CLAUDE_ISOLATED: "1", CLAUDE_CONFIG_DIR: "/x" }, "/h", "/k")).toBe("/k/claude");
});

test("only KIBO_CLAUDE_ISOLATED=1 isolates claude", () => {
  expect(isClaudeIsolated({ KIBO_CLAUDE_ISOLATED: "1" })).toBe(true);
  expect(isClaudeIsolated({ KIBO_CLAUDE_ISOLATED: "true" })).toBe(false);
  expect(isClaudeIsolated({})).toBe(false);
});

test("the plugins root follows CLAUDE_CODE_PLUGIN_CACHE_DIR, else <claude home>/plugins", () => {
  expect(pluginsRootOf({ CLAUDE_CODE_PLUGIN_CACHE_DIR: "/p" }, "/c")).toBe("/p");
  expect(pluginsRootOf({}, "/c")).toBe("/c/plugins");
  expect(pluginsRootOf({ CLAUDE_CODE_PLUGIN_CACHE_DIR: "" }, "/c")).toBe("/c/plugins");
});
