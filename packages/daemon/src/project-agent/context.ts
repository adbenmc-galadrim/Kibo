import type { NoteHash } from "@kibo/core/project-agent/fingerprint";
import type { ProjectFingerprint } from "@kibo/schema";
import type { Notice } from "../runs/notifier";
import type { Orchestrator } from "../runs/orchestrator";
import type { ProjectAgentStore } from "./store";
import type { ProjectAgentAgentsPort, ProjectAgentDataPort, ProjectAgentOps } from "./types";

export type ProjectAgentAgents = ProjectAgentAgentsPort & Pick<Orchestrator, "hooks">;

export type ProjectAgentDeps = {
  store: ProjectAgentStore;
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgents;
  ops: ProjectAgentOps;
  notify: (notice: Notice) => void;
  emit: () => void;
  now?: () => number;
  agentBody?: () => string;
};

export type AgentContext = Required<ProjectAgentDeps> & {
  turnNotes: Map<string, NoteHash[]>;
  baselines: Map<string, ProjectFingerprint>;
};
