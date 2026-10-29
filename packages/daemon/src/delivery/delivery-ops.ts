import { getQuestion, readProject } from "@kibo/core";
import {
  type Agent,
  type AgentSettings,
  type AgentSettingsPatch,
  type DeliverResult,
  type DeliveryAgent,
  type DeliveryKind,
  deliveryAgentInfo,
  KiboError,
  type RunDenials,
  type RunView,
} from "@kibo/schema";
import type { DenialStore } from "../agents/denial-store";
import { type Docs, USER_COMMAND } from "../docs";
import { assertNotInboxForAgents } from "../inbox/inbox-rules";
import type { AgentDataPort, Orchestrator } from "../runs/orchestrator-types";
import { type AllowResumeDeps, type AllowResumeInput, allowAndResume } from "./allow-resume";
import { type DeliverDeps, type DeliveryProject, deliver } from "./deliver";

export type DeliveryDocs = Pick<
  Docs,
  "project" | "projectIds" | "activity" | "projectMeta" | "assertWritable" | "identity" | "run" | "today"
>;
export type DeliveryOpsDeps = {
  home: string;
  docs(): DeliveryDocs;
  agentData(): Pick<AgentDataPort, "agents" | "agentOf" | "markAnswersDelivered">;
  agentSettings(): { settings(ref: string, patch: AgentSettingsPatch): AgentSettings };
  orchestrator(): Pick<Orchestrator, "state" | "answer">;
  denials: Pick<DenialStore, "get">;
};
export type DeliveryOps = {
  deliverDeps(): DeliverDeps;
  deliver(projectId: string, ticketId: string, mode?: DeliveryKind): DeliverResult;
  deliveryAgent(projectId: string): DeliveryAgent | null;
  run(runId: string): RunView & { projectId: string };
  denials(runId: string): RunDenials | null;
  allowAndResume(input: AllowResumeInput): { agent: Agent; run: RunView };
};

function deliveryProject(docs: DeliveryDocs, projectId: string): DeliveryProject {
  const snapshot = readProject(docs.project(projectId), docs.today(), docs.activity(projectId));
  return {
    delivery: docs.projectMeta(projectId).delivery,
    tickets: snapshot.tickets,
    links: snapshot.links,
    questions: snapshot.questions,
  };
}

function openQuestionOf(docs: DeliveryDocs, projectId: string, questionId: string) {
  try {
    return getQuestion(docs.project(projectId), questionId);
  } catch (e) {
    if (e instanceof KiboError && e.code === "NOT_FOUND") return null;
    throw e;
  }
}

function allowDeps(deps: DeliveryOpsDeps): AllowResumeDeps {
  const docs = deps.docs();
  const data = deps.agentData();
  return {
    agents: {
      agentOf: (ref) => data.agentOf(ref),
      settings: (ref, p) => deps.agentSettings().settings(ref, p),
    },
    questions: {
      get: (projectId, questionId) => openQuestionOf(docs, projectId, questionId),
      answer(projectId, questionId, text, by) {
        docs.run(
          projectId,
          { method: "answerQuestion", questionId, answer: { kind: "text", text }, by },
          USER_COMMAND,
        );
      },
      markDelivered: (projectId, ticketId, ids, runId) =>
        data.markAnswersDelivered(projectId, ticketId, ids, runId),
    },
    orchestrator: deps.orchestrator(),
    denials: deps.denials,
    viewer: (projectId) => docs.identity(projectId),
    home: deps.home,
  };
}

export function createDeliveryOps(deps: DeliveryOpsDeps): DeliveryOps {
  const deliverDeps = (): DeliverDeps => ({
    project: (projectId) => deliveryProject(deps.docs(), projectId),
    agents: (projectId) => deps.agentData().agents(projectId),
    orchestrator: deps.orchestrator(),
  });
  const run = (runId: string): RunView & { projectId: string } => {
    const found = deps
      .orchestrator()
      .state()
      .runs.find((r) => r.id === runId);
    const projectId = found?.projectId ?? null;
    if (!found || projectId === null || !deps.docs().projectIds().includes(projectId))
      throw new KiboError("NOT_FOUND", `run ${runId} not found`);
    return { ...found, projectId };
  };
  return {
    deliverDeps,
    deliver(projectId, ticketId, mode) {
      assertNotInboxForAgents(projectId);
      deps.docs().assertWritable(projectId);
      return deliver(deliverDeps(), { projectId, ticketId, mode });
    },
    deliveryAgent: (projectId) =>
      deliveryAgentInfo(deps.agentData().agents(projectId), deps.docs().projectMeta(projectId).delivery),
    run,
    denials(runId) {
      run(runId);
      return deps.denials.get(runId);
    },
    allowAndResume(input) {
      deps.docs().assertWritable(run(input.runId).projectId);
      return allowAndResume(allowDeps(deps), input);
    },
  };
}
