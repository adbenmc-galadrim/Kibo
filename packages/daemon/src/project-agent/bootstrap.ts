import type { Notice } from "../agents/notifier";
import type { Docs } from "../docs";
import type { Service } from "../service";
import { ready } from "../service-ports";
import { applyBatch } from "./apply-batch";
import { createProjectAgentDataPort, type ProjectAgentDataDeps } from "./data-port";
import { createProjectAgentService, type ProjectAgentAgents, type ProjectAgentService } from "./service";
import { openProjectAgentStore, type ProjectAgentStore } from "./store";
import { handleProjectTool } from "./tools";
import type {
  ProjectAgentAgentsPort,
  ProjectAgentDataPort,
  ProjectAgentOps,
  ProjectAgentSignalsPort,
} from "./types";

export type ProjectAgentBoot = { agent: ProjectAgentService; stop(): void };

export type ProjectAgentBootInput = {
  home: string;
  service: Pick<Service, "deliverAnswers" | "attachProjectAgent" | "agentData"> & { docs: Docs };
  notes: ProjectAgentDataDeps["notes"];
  settings: ProjectAgentDataDeps["settings"];
  orchestrator: () => Omit<ProjectAgentAgents, "deliverAnswers">;
  notify: (notice: Notice) => void;
  signals: ProjectAgentSignalsPort;
};

type OpsDeps = {
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgentsPort;
  signals: ProjectAgentSignalsPort;
  store: ProjectAgentStore;
  agent: () => ProjectAgentService;
};

function projectAgentOps({ data, agents, signals, store, agent }: OpsDeps): ProjectAgentOps {
  const toolDeps = {
    data,
    agents,
    signals,
    store: {
      fingerprint: (runId: string) => agent().baseline(runId),
      lastDecided: (projectId: string, since: number) => store.lastDecided(projectId, since),
    },
    propose: (run: Parameters<ProjectAgentService["propose"]>[0], input: unknown) =>
      agent().propose(run, input),
  };
  return {
    tool: (run, tool, input) => handleProjectTool(toolDeps, run, tool, input),
    apply: (batch, chosen, by) => applyBatch({ data, agents, signals }, batch, chosen, by),
  };
}

export function startProjectAgent(input: ProjectAgentBootInput): ProjectAgentBoot {
  const { service } = input;
  const store = openProjectAgentStore(input.home);
  const data = createProjectAgentDataPort({
    docs: service.docs,
    notes: input.notes,
    settings: input.settings,
    agents: (projectId) => service.agentData.agents(projectId),
    guidelines: (projectId) => service.agentData.guidelines(projectId),
  });
  const agents = () => ({ ...input.orchestrator(), deliverAnswers: service.deliverAnswers });
  let self: ProjectAgentService | null = null;
  const agent = createProjectAgentService({
    store,
    data,
    signals: input.signals,
    ops: projectAgentOps({
      data,
      agents,
      signals: input.signals,
      store,
      agent: () => ready(self, "INTERNAL", "the project agent is not ready"),
    }),
    agents,
    notify: input.notify,
    emit: () => service.docs.emit({ topic: "agents" }),
  });
  self = agent;
  const detach = service.attachProjectAgent(agent);
  return {
    agent,
    stop() {
      detach();
      store.close();
    },
  };
}
