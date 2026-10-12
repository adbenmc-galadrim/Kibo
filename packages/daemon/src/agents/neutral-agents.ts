import { runModel } from "@kibo/core/agents/compose";
import {
  type Agent,
  type AgentFile,
  type AgentRef,
  type AgentScope,
  type AgentSettings,
  DEFAULT_AGENT_SETTINGS,
  SYSTEM_AGENT_IDS,
  systemAgentName,
  systemAgentRef,
  systemAgentSettings,
} from "@kibo/schema";

export type MemoryAgentInput = {
  ref: AgentRef;
  scope: AgentScope;
  name: string;
  projectId?: string | null;
  settings?: Partial<AgentSettings>;
  file?: AgentFile | null;
};

export function memoryAgent(input: MemoryAgentInput): Agent {
  return {
    ref: input.ref,
    scope: input.scope,
    projectId: input.projectId ?? null,
    name: input.name,
    path: "",
    hash: null,
    file: input.file ?? null,
    problem: null,
    nameWarning: null,
    settings: { ...DEFAULT_AGENT_SETTINGS, ...input.settings },
    shadowedBy: null,
    activeRuns: 0,
    modifiedAt: null,
  };
}

export const NEUTRAL_SYSTEM_AGENTS: readonly Agent[] = SYSTEM_AGENT_IDS.map((id) =>
  memoryAgent({
    ref: systemAgentRef(id),
    scope: "system",
    name: systemAgentName(id),
    settings: systemAgentSettings(id, {}),
  }),
);

export type AgentSource = {
  agents(projectId: string | null): Agent[];
  agentOf(ref: AgentRef): Agent | null;
};

export function memoryAgentSource(agents: readonly Agent[]): AgentSource {
  return {
    agents: (projectId) => agents.filter((a) => a.projectId === null || a.projectId === projectId),
    agentOf: (ref) => agents.find((a) => a.ref === ref) ?? null,
  };
}

export const NEUTRAL_AGENT_SOURCE: AgentSource = memoryAgentSource(NEUTRAL_SYSTEM_AGENTS);

export const agentModelOf = (agent: Pick<Agent, "file">): string =>
  runModel(agent.file?.frontmatter ?? null).model;
