import { expect, test } from "bun:test";
import { NO_AGENT_FLAGS } from "./cli-flags";
import { claudeArgs, type LaunchInput, launchArgs } from "./runner";

const launchInput = (baseEnv: Record<string, string | undefined>): LaunchInput => ({
  model: "opus",
  permissionFlag: null,
  extraArgs: [],
  systemPromptFile: "/r/CLAUDE.md",
  hook: { command: "/k/kibo-hook", args: [] },
  allow: [],
  deny: [],
  mcpConfigFile: null,
  mcpTools: null,
  sessionId: "s1",
  resume: false,
  claudeBin: "claude",
  cwd: "/w",
  prompt: "p",
  mcpUrl: null,
  hookUrl: "http://127.0.0.1:1/hooks/r1",
  token: "t",
  baseEnv,
  extraEnv: {},
  agentFlags: NO_AGENT_FLAGS,
});
const base = launchInput({});

test("an isolated run reads only the project settings and only Kibo's MCP servers", () => {
  const args = claudeArgs({ ...base, isolated: true });
  expect(args[args.indexOf("--setting-sources") + 1]).toBe("project,local");
  expect(args).toContain("--strict-mcp-config");
  expect(args).toContain("--settings");
  expect(args).toContain("--mcp-config");
});

test("a regular run keeps the user's Claude configuration", () => {
  const args = claudeArgs(base);
  expect(args).not.toContain("--setting-sources");
  expect(args).not.toContain("--strict-mcp-config");
});

test("an isolated run cannot widen its setting sources through extra arguments", () => {
  for (const extra of [["--setting-sources", "user,project"], ["--setting-sources=user"]]) {
    expect(() => claudeArgs({ ...base, extraArgs: extra, isolated: true })).toThrow("INVALID_INPUT");
  }
});

test("KIBO_CLAUDE_ISOLATED=1 in the daemon environment isolates the launched claude", () => {
  expect(launchArgs(launchInput({ KIBO_CLAUDE_ISOLATED: "1" }))).toContain("--setting-sources");
  expect(launchArgs(launchInput({ KIBO_CLAUDE_ISOLATED: "0" }))).not.toContain("--setting-sources");
  expect(launchArgs(launchInput({}))).not.toContain("--setting-sources");
});
