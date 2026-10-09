import type { NoteHash } from "@kibo/core/project-agent/fingerprint";
import type { Notice } from "../agents/notifier";
import type { Orchestrator } from "../agents/orchestrator";
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
};

export type AgentContext = Required<ProjectAgentDeps> & { turnNotes: Map<string, NoteHash[]> };
