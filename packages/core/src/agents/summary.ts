import type { Agent, AgentSummary } from "@kibo/schema";

export function agentSummary(agent: Agent): AgentSummary {
  const { file, ...rest } = agent;
  const { skills, subagents } = agent.settings;
  return {
    ...rest,
    description: file?.frontmatter.description ?? "",
    model: file?.frontmatter.model ?? null,
    skillsCount: skills.mode === "all" ? null : skills.ids.length,
    subagentsCount: subagents.length,
  };
}
