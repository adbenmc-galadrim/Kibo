import { type Agent, type AgentSettings, type SystemAgentId, systemAgentRef } from "@kibo/schema";
import { type AgentSource, memoryAgent, memoryAgentSource, NEUTRAL_SYSTEM_AGENTS } from "./neutral-agents";

export type TestAgentInput = Partial<AgentSettings> & {
  id?: string;
  name?: string;
  model?: string;
  system?: boolean;
};

const isSystemId = (id: string): id is SystemAgentId =>
  ["assistant", "generateur", "demo", "project-agent"].includes(id);

export const testRef = (id: string): string => (id.includes(":") ? id : `global:${id}`);

export function testAgent(p: TestAgentInput = {}): Agent {
  const { id = "opus", name = "opus-dev", model = "opus", system = false, ...settings } = p;
  const ref = system && isSystemId(id) ? systemAgentRef(id) : testRef(id);
  return memoryAgent({
    ref,
    scope: system ? "system" : "global",
    name,
    settings: { permissionMode: "acceptEdits", workspace: "isolated", maxParallel: 4, ...settings },
    file: { frontmatter: { name, description: `Agent ${name}`, model, extra: "", extraKeys: [] }, body: "" },
  });
}

export const projectAgentAgent = (): Agent =>
  testAgent({
    id: "project-agent",
    name: "kibo-project-agent",
    permissionMode: "default",
    maxParallel: 1,
    system: true,
  });

export const agentsPort = (agents: readonly Agent[]) => ({
  agents: () => [...agents],
  agentOf: (ref: string) => agents.find((a) => a.ref === ref) ?? null,
});

export type TestAgentSource = { source: AgentSource; add(agent: Agent): Agent };

export function testAgentSource(initial: readonly Agent[] = []): TestAgentSource {
  const agents = [...NEUTRAL_SYSTEM_AGENTS, ...initial];
  return {
    source: {
      agents: (projectId) => memoryAgentSource(agents).agents(projectId),
      agentOf: (ref) => memoryAgentSource(agents).agentOf(ref),
    },
    add(agent) {
      const at = agents.findIndex((a) => a.ref === agent.ref);
      if (at === -1) agents.push(agent);
      else agents[at] = agent;
      return agent;
    },
  };
}
