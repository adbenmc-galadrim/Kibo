import { expect, test } from "bun:test";
import { TICKET_MCP_TOOLS } from "@kibo/schema";
import { type AgentFlags, BUILTIN_TOOLS, NO_AGENT_FLAGS, NO_CLI_FALLBACKS } from "./cli-flags";
import { claudeArgs } from "./runner";

const base: Parameters<typeof claudeArgs>[0] = {
  model: "fable",
  permissionFlag: null,
  extraArgs: [],
  systemPromptFile: "/r/CLAUDE.md",
  hook: { command: "/k/kibo-hook", args: [] },
  allow: ["Bash(git *)"],
  deny: [],
  mcpConfigFile: "/r/mcp.json",
  mcpTools: "ticket",
  sessionId: "s1",
  resume: false,
};

const flags: AgentFlags = {
  name: "global · review-pr · KIB-3",
  agents: "/r/agents.json",
  tools: ["Read", "Grep"],
  disallowedTools: null,
  skillRules: ["Skill(brainstorming)", "Skill(superpowers:brainstorming)"],
  fallbacks: NO_CLI_FALLBACKS,
};

const at = (args: string[], name: string) => args.indexOf(name);
const value = (args: string[], name: string) => args[at(args, name) + 1];
const allowOf = (args: string[]): string[] => JSON.parse(value(args, "--settings") ?? "{}").permissions.allow;

test("a fresh session passes the agent's model, settings, subagents, tools, snapshot and name in order", () => {
  const args = claudeArgs({ ...base, agentFlags: flags });
  const order = [
    "--model",
    "--settings",
    "--agents",
    "--tools",
    "--system-prompt-snapshot",
    "--name",
    "--session-id",
  ];
  const positions = order.map((name) => at(args, name));
  expect(positions.every((p) => p >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect(value(args, "--model")).toBe("fable");
  expect(value(args, "--agents")).toBe("/r/agents.json");
  expect(value(args, "--tools")).toBe("Read,Grep");
  expect(value(args, "--system-prompt-snapshot")).toBe("off");
  expect(value(args, "--name")).toBe("global · review-pr · KIB-3");
  expect(args).not.toContain("--disallowedTools");
  const allow = allowOf(args);
  expect(allow).toContain("Skill(brainstorming)");
  expect(allow).toContain("Skill(superpowers:brainstorming)");
  expect(allow).toContain("Bash(git *)");
  for (const tool of TICKET_MCP_TOOLS) expect(allow).toContain(tool);
});

test("a resumed session keeps the flags but not the name", () => {
  const args = claudeArgs({ ...base, resume: true, agentFlags: flags });
  expect(args).not.toContain("--name");
  expect(value(args, "--system-prompt-snapshot")).toBe("off");
  expect(args.slice(-2)).toEqual(["--resume", "s1"]);
});

test("disallowed tools are passed, absent tools and subagents are not", () => {
  const args = claudeArgs({
    ...base,
    agentFlags: { ...flags, tools: null, agents: null, disallowedTools: ["WebFetch", "Bash"] },
  });
  expect(args).not.toContain("--tools");
  expect(args).not.toContain("--agents");
  expect(value(args, "--disallowedTools")).toBe("WebFetch,Bash");
  expect(claudeArgs(base)).not.toContain("--system-prompt-snapshot");
  expect(claudeArgs({ ...base, agentFlags: NO_AGENT_FLAGS })).toContain("--system-prompt-snapshot");
});

test("Kibo's own flags are reserved, and the tool flags whenever the agent sets them", () => {
  const refused = (extraArgs: string[], agentFlags: AgentFlags = flags) =>
    expect(() => claudeArgs({ ...base, extraArgs, agentFlags })).toThrow("INVALID_INPUT");
  refused(["--agents", "{}"]);
  refused(["--name", "x"]);
  refused(["-n", "x"]);
  refused(["--system-prompt-snapshot", "on"]);
  refused(["--tools", "Bash"]);
  refused(["--tools=Bash"]);
  refused(["--disallowedTools", "Read"], { ...flags, disallowedTools: ["Bash"] });
  const task = claudeArgs({ ...base, extraArgs: ["--tools", "Read,Bash"], agentFlags: NO_AGENT_FLAGS });
  expect(value(task, "--tools")).toBe("Read,Bash");
});

test("a malformed skill rule is refused", () => {
  for (const rule of ["Skill(Bad Id)", "Bash(rm *)", "Skill()"])
    expect(() => claudeArgs({ ...base, agentFlags: { ...flags, skillRules: [rule] } })).toThrow(
      "INVALID_INPUT",
    );
});

test("fallback: the tools become the complement of the built-in set in --disallowedTools", () => {
  const args = claudeArgs({
    ...base,
    agentFlags: {
      ...flags,
      disallowedTools: ["WebFetch"],
      fallbacks: { ...NO_CLI_FALLBACKS, toolsAsDisallowed: true },
    },
  });
  expect(args).not.toContain("--tools");
  const denied = (value(args, "--disallowedTools") ?? "").split(",");
  expect(denied).toContain("WebFetch");
  expect(denied).toContain("Bash");
  expect(denied).toContain("Skill");
  expect(denied).not.toContain("Read");
  expect(denied).not.toContain("Grep");
  expect(new Set(denied).size).toBe(denied.length);
  expect(BUILTIN_TOOLS).toContain("Agent");
});

test("fallback: no snapshot flag when the CLI refuses it", () => {
  const args = claudeArgs({
    ...base,
    agentFlags: { ...flags, fallbacks: { ...NO_CLI_FALLBACKS, noPromptSnapshot: true } },
  });
  expect(args).not.toContain("--system-prompt-snapshot");
});
