import { KiboError } from "@kibo/schema";
import { CLAUDE_BUILTIN_TOOLS } from "../ai/claude-cli";

export type CliFallbacks = {
  agentsInline: boolean;
  toolsAsDisallowed: boolean;
  skillArgsRule: boolean;
  nameInPrompt: boolean;
  noPromptSnapshot: boolean;
};

export const NO_CLI_FALLBACKS: CliFallbacks = {
  agentsInline: false,
  toolsAsDisallowed: false,
  skillArgsRule: false,
  nameInPrompt: false,
  noPromptSnapshot: false,
};

export type AgentFlags = {
  name: string | null;
  agents: string | null;
  tools: readonly string[] | null;
  disallowedTools: readonly string[] | null;
  skillRules: readonly string[];
  fallbacks: CliFallbacks;
};

export const NO_AGENT_FLAGS: AgentFlags = {
  name: null,
  agents: null,
  tools: null,
  disallowedTools: null,
  skillRules: [],
  fallbacks: NO_CLI_FALLBACKS,
};

export const BUILTIN_TOOLS: readonly string[] = [...CLAUDE_BUILTIN_TOOLS, "Skill"];

const ALWAYS_RESERVED = ["--agents", "--name", "-n", "--system-prompt-snapshot"];
const SKILL_RULE = /^Skill\(([a-z0-9][a-z0-9-]{0,63}:)?[a-z0-9][a-z0-9._-]{0,63}( \*)?\)$/;

function toolSets(flags: AgentFlags): { tools: readonly string[] | null; disallowed: readonly string[] } {
  const disallowed = flags.disallowedTools ?? [];
  if (flags.tools === null || !flags.fallbacks.toolsAsDisallowed) return { tools: flags.tools, disallowed };
  const allowed = new Set(flags.tools);
  const complement = BUILTIN_TOOLS.filter((t) => !allowed.has(t));
  return { tools: null, disallowed: [...new Set([...disallowed, ...complement])] };
}

export function reservedAgentArgs(flags: AgentFlags | undefined): string[] {
  if (!flags) return [];
  const { tools, disallowed } = toolSets(flags);
  return [
    ...ALWAYS_RESERVED,
    ...(tools === null ? [] : ["--tools"]),
    ...(disallowed.length === 0 ? [] : ["--disallowedTools", "--disallowed-tools"]),
  ];
}

export function checkedSkillRules(rules: readonly string[]): string[] {
  const bad = rules.find((rule) => !SKILL_RULE.test(rule));
  if (bad !== undefined) throw new KiboError("INVALID_INPUT", `malformed skill rule ${bad}`);
  return [...rules];
}

export function agentArgs(flags: AgentFlags | undefined, resume: boolean): string[] {
  if (!flags) return [];
  const { tools, disallowed } = toolSets(flags);
  return [
    ...(flags.agents === null ? [] : ["--agents", flags.agents]),
    ...(tools === null ? [] : ["--tools", tools.join(",")]),
    ...(disallowed.length === 0 ? [] : ["--disallowedTools", disallowed.join(",")]),
    ...(flags.fallbacks.noPromptSnapshot ? [] : ["--system-prompt-snapshot", "off"]),
    ...(flags.name === null || resume ? [] : ["--name", flags.name]),
  ];
}
