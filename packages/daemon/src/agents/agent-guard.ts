import { agentGuard, type GuardRules } from "@kibo/core/agents/guard";
import { type Agent, type AgentRef, parseAgentRef, systemAgentName } from "@kibo/schema";
import type { ToolGuard } from "./orchestrator-types";

const CLOSED: GuardRules = {
  subagents: [],
  genericSubagents: false,
  allSubagents: false,
  skills: { mode: "list", ids: [] },
};

export function subagentName(ref: AgentRef): string {
  const parsed = parseAgentRef(ref);
  return parsed.scope === "system" ? systemAgentName(parsed.id) : parsed.name;
}

function rulesOf(agent: Pick<Agent, "settings"> | null): GuardRules {
  if (agent === null) return CLOSED;
  const { subagents, genericSubagents, allSubagents, skills } = agent.settings;
  return { subagents: subagents.map(subagentName), genericSubagents, allSubagents, skills };
}

export function agentGuardOf(agent: Pick<Agent, "settings"> | null): ToolGuard {
  const guard = agentGuard(rulesOf(agent));
  return ({ tool, input }) => guard({ tool, input: input ?? {} });
}
