import type { Notice } from "../agents/notifier";
import type { Docs } from "../docs";
import type { Service } from "../service";
import { ready } from "../service-ports";
import { applyBatch } from "./apply-batch";
import { createProjectAgentDataPort, type ProjectAgentDataDeps } from "./data-port";
import { createProjectAgentService, type ProjectAgentAgents, type ProjectAgentService } from "./service";
import { openProjectAgentStore, type ProjectAgentStore } from "./store";
import { handleProjectTool } from "./tools";
import type { ProjectAgentAgentsPort, ProjectAgentDataPort, ProjectAgentOps } from "./types";

export type ProjectAgentBoot = { agent: ProjectAgentService; stop(): void };

export type ProjectAgentBootInput = {
  home: string;
  service: Pick<Service, "deliverAnswers" | "attachProjectAgent" | "agentData"> & { docs: Docs };
  notes: ProjectAgentDataDeps["notes"];
  settings: ProjectAgentDataDeps["settings"];
  orchestrator: () => Omit<ProjectAgentAgents, "deliverAnswers">;
  notify: (notice: Notice) => void;
};

type OpsDeps = {
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgentsPort;
  store: ProjectAgentStore;
  agent: () => ProjectAgentService;
};

function projectAgentOps({ data, agents, store, agent }: OpsDeps): ProjectAgentOps {
  const toolDeps = {
    data,
    agents,
    store: {
      fingerprint: (runId: string) => agent().baseline(runId),
      lastDecided: (projectId: string, since: number) => store.lastDecided(projectId, since),
    },
    propose: (run: Parameters<ProjectAgentService["propose"]>[0], input: unknown) =>
      agent().propose(run, input),
  };
  return {
    tool: (run, tool, input) => handleProjectTool(toolDeps, run, tool, input),
    apply: (batch, chosen, by) => applyBatch({ data, agents }, batch, chosen, by),
  };
}

export function startProjectAgent(input: ProjectAgentBootInput): ProjectAgentBoot {
  const { service } = input;
  const store = openProjectAgentStore(input.home);
  const data = createProjectAgentDataPort({
    docs: service.docs,
    notes: input.notes,
    settings: input.settings,
    profiles: () => service.agentData.profiles(),
    guidelines: (projectId) => service.agentData.guidelines(projectId),
  });
  const agents = () => ({ ...input.orchestrator(), deliverAnswers: service.deliverAnswers });
  let self: ProjectAgentService | null = null;
  const agent = createProjectAgentService({
    store,
    data,
    ops: projectAgentOps({
      data,
      agents,
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
