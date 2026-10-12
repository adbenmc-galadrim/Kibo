import { expect, test } from "bun:test";
import { claudeHomeOf, pluginsRootOf } from "./claude-home";

test("the Claude home follows CLAUDE_CONFIG_DIR, else ~/.claude", () => {
  expect(claudeHomeOf({ CLAUDE_CONFIG_DIR: "/x" }, "/h")).toBe("/x");
  expect(claudeHomeOf({}, "/h")).toBe("/h/.claude");
  expect(claudeHomeOf({ CLAUDE_CONFIG_DIR: "" }, "/h")).toBe("/h/.claude");
});

test("the plugins root follows CLAUDE_CODE_PLUGIN_CACHE_DIR, else <claude home>/plugins", () => {
  expect(pluginsRootOf({ CLAUDE_CODE_PLUGIN_CACHE_DIR: "/p" }, "/c")).toBe("/p");
  expect(pluginsRootOf({}, "/c")).toBe("/c/plugins");
  expect(pluginsRootOf({ CLAUDE_CODE_PLUGIN_CACHE_DIR: "" }, "/c")).toBe("/c/plugins");
});
