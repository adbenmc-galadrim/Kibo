import type { NoteHash } from "@kibo/core/project-agent/fingerprint";
import type { AgentExecution, ProjectFingerprint } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { Orchestrator } from "../agents/orchestrator";
import type { ProjectAgentStore } from "./store";
import type {
  ProjectAgentAgentsPort,
  ProjectAgentDataPort,
  ProjectAgentOps,
  ProjectAgentSignalsPort,
} from "./types";

export type ProjectAgentAgents = ProjectAgentAgentsPort & Pick<Orchestrator, "hooks">;

export type ProjectAgentDeps = {
  store: ProjectAgentStore;
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgents;
  ops: ProjectAgentOps;
  signals: ProjectAgentSignalsPort;
  notify: (notice: Notice) => void;
  emit: () => void;
  now?: () => number;
  formatTime?: (at: number) => string;
  agentBody?: () => string;
  agentExecution?: () => AgentExecution;
};

export type AgentContext = Required<ProjectAgentDeps> & {
  turnNotes: Map<string, NoteHash[]>;
  baselines: Map<string, ProjectFingerprint>;
};
