import { DEFAULT_PROJECT_AGENT_BODY } from "@kibo/core/agents/compose";
import {
  type AgentExecution,
  PROJECT_AGENT_REF,
  type ProjectEventSink,
  type ProjectFingerprint,
} from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { AgentDataPort, Orchestrator } from "../agents/orchestrator-types";
import type { Docs } from "../docs";
import { planRpc } from "../plan/plan-rpc";
import { createPlanService } from "../plan/plan-service";
import type { RpcExtension } from "../rpc-extensions";
import type { Service } from "../service";
import { ready } from "../service-ports";
import { applyBatch } from "./apply-batch";
import { type BatchJournal, createBatchJournal } from "./batch-journal";
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

export type ProjectAgentBoot = { agent: ProjectAgentService; plan: { rpc: RpcExtension }; stop(): void };

export type ProjectAgentBootInput = {
  home: string;
  service: Pick<Service, "deliverAnswers" | "attachProjectAgent" | "agentData"> & { docs: Docs };
  notes: ProjectAgentDataDeps["notes"];
  settings: ProjectAgentDataDeps["settings"];
  orchestrator: () => Omit<ProjectAgentAgents, "deliverAnswers"> & Pick<Orchestrator, "onRunState">;
  notify: (notice: Notice) => void;
  signals: ProjectAgentSignalsPort;
  agentBody?: () => string;
  agentExecution?: () => AgentExecution;
  events?: ProjectEventSink;
};

export const projectAgentBody = (data: Pick<AgentDataPort, "agentOf">): string =>
  data.agentOf(PROJECT_AGENT_REF)?.file?.body ?? DEFAULT_PROJECT_AGENT_BODY;

type OpsDeps = {
  data: ProjectAgentDataPort;
  agents: () => ProjectAgentAgentsPort;
  signals: ProjectAgentSignalsPort;
  store: ProjectAgentStore;
  agent: () => ProjectAgentService;
  events?: ProjectEventSink;
};

function projectAgentOps({ data, agents, signals, store, agent, events }: OpsDeps): ProjectAgentOps {
  const toolDeps = {
    data,
    agents,
    signals,
    store: {
      fingerprint: (runId: string, current?: ProjectFingerprint) => agent().baseline(runId, current),
      lastDecided: (projectId: string, since: number) => store.lastDecided(projectId, since),
    },
    propose: (run: Parameters<ProjectAgentService["propose"]>[0], input: unknown) =>
      agent().propose(run, input),
  };
  return {
    tool: (run, tool, input) => handleProjectTool(toolDeps, run, tool, input),
    apply: (batch, chosen, by) => applyBatch({ data, agents, signals, events }, batch, chosen, by),
  };
}

function batchJournal(input: ProjectAgentBootInput): BatchJournal | undefined {
  const { events, orchestrator } = input;
  if (!events) return undefined;
  return createBatchJournal({
    events,
    turnOf: (runId) =>
      orchestrator()
        .state()
        .runs.find((r) => r.id === runId)?.turns ?? null,
    onRunState: (listener) => orchestrator().onRunState(listener),
  });
}

export function startProjectAgent(input: ProjectAgentBootInput): ProjectAgentBoot {
  const { service } = input;
  const journal = batchJournal(input);
  const store = openProjectAgentStore(input.home, journal);
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
      events: input.events,
    }),
    agents,
    notify: input.notify,
    agentBody: input.agentBody ?? (() => projectAgentBody(service.agentData)),
    agentExecution: input.agentExecution,
    emit: () => service.docs.emit({ topic: "agents" }),
  });
  self = agent;
  const detach = service.attachProjectAgent(agent);
  return {
    agent,
    plan: { rpc: planRpc(createPlanService({ data, events: input.events })) },
    stop() {
      detach();
      journal?.close();
      store.close();
    },
  };
}
