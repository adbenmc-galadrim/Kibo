import { runModel } from "@kibo/core/agents/compose";
import {
  type Agent,
  type AgentFile,
  type AgentRef,
  type AgentScope,
  type AgentSettings,
  DEFAULT_AGENT_SETTINGS,
  type Skill,
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
    settings: systemAgentSettings({}),
  }),
);

export type AgentSource = {
  agents(projectId: string | null): Agent[];
  agentOf(ref: AgentRef): Agent | null;
  skills?(projectId: string | null): Skill[];
};

const visibleFrom = (projectId: string | null) => (item: { projectId: string | null }) =>
  projectId === null || item.projectId === null || item.projectId === projectId;

export function memoryAgentSource(agents: readonly Agent[], skills: readonly Skill[] = []): AgentSource {
  return {
    agents: (projectId) => agents.filter(visibleFrom(projectId)),
    agentOf: (ref) => agents.find((a) => a.ref === ref) ?? null,
    skills: (projectId) => skills.filter(visibleFrom(projectId)),
  };
}

export const NEUTRAL_AGENT_SOURCE: AgentSource = memoryAgentSource(NEUTRAL_SYSTEM_AGENTS);

export const agentModelOf = (agent: Pick<Agent, "file">): string =>
  runModel(agent.file?.frontmatter ?? null).model;
