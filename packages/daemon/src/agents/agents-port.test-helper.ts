import {
  type Agent,
  type AgentFile,
  type AgentSettings,
  type SystemAgentId,
  systemAgentRef,
} from "@kibo/schema";
import { type AgentSource, memoryAgent, memoryAgentSource, NEUTRAL_SYSTEM_AGENTS } from "./neutral-agents";

export type TestAgentInput = Partial<AgentSettings> & {
  id?: string;
  name?: string;
  model?: string;
  system?: boolean;
  projectId?: string;
  body?: string;
  tools?: string[];
  file?: AgentFile | null;
};

const isSystemId = (id: string): id is SystemAgentId =>
  ["assistant", "generateur", "demo", "project-agent"].includes(id);

export const testRef = (id: string): string => (id.includes(":") ? id : `global:${id}`);

const testFile = (name: string, model: string, body: string, tools: string[] | undefined): AgentFile => ({
  frontmatter: {
    name,
    description: `Agent ${name}`,
    model,
    ...(tools === undefined ? {} : { tools }),
    extra: "",
    extraKeys: [],
  },
  body,
});

function refOf(id: string, system: boolean, projectId: string | undefined): string {
  if (system && isSystemId(id)) return systemAgentRef(id);
  return projectId === undefined ? testRef(id) : `project:${projectId}:${id}`;
}

export function testAgent(p: TestAgentInput = {}): Agent {
  const {
    id = "opus",
    name = "opus-dev",
    model = "opus",
    system = false,
    projectId,
    body = "",
    tools,
    file,
    ...settings
  } = p;
  return memoryAgent({
    ref: refOf(id, system, projectId),
    scope: system ? "system" : projectId === undefined ? "global" : "project",
    name,
    projectId: projectId ?? null,
    settings: { permissionMode: "acceptEdits", workspace: "isolated", maxParallel: 4, ...settings },
    file: file === undefined ? testFile(name, model, body, tools) : file,
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
