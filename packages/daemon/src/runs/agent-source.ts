import type { AgentCatalog } from "../agent-files/catalog";
import type { SkillsService } from "../skills/service";
import { type AgentSource, NEUTRAL_AGENT_SOURCE } from "./neutral-agents";

export function catalogAgentSource(
  catalog: Pick<AgentCatalog, "list" | "byRef">,
  skills: Pick<SkillsService, "list">,
): AgentSource {
  return {
    agents: (projectId) => catalog.list(projectId),
    agentOf: (ref) => catalog.byRef(ref),
    skills: (projectId) => skills.list(projectId).skills,
  };
}

export type LateAgentSource = { source: AgentSource; bind(source: AgentSource): () => void };

export function lateAgentSource(fallback: AgentSource = NEUTRAL_AGENT_SOURCE): LateAgentSource {
  let current = fallback;
  return {
    source: {
      agents: (projectId) => current.agents(projectId),
      agentOf: (ref) => current.agentOf(ref),
      skills: (projectId) => current.skills?.(projectId) ?? [],
    },
    bind(source) {
      current = source;
      return () => {
        current = fallback;
      };
    },
  };
}
