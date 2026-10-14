import {
  executeProjectCommand,
  getKeyAllocator,
  listProjectDomainGuidelines,
  listProjectDomains,
  listQuestions,
  listTickets,
  readProject,
} from "@kibo/core";
import { listDomains, listGuidelines } from "@kibo/core/agent-config";
import { listQuestionRecipients } from "@kibo/core/question-recipients";
import { evaluateRules, type RuleTrigger, readRules } from "@kibo/core/rules";
import {
  type Actor,
  type AskInput,
  countOpenByRun,
  domainsOf as domainsOfProject,
  type Guideline,
  isOpen,
  KiboError,
  OPEN_PER_RUN_MAX,
  type ProjectCommand,
  Question,
  resolveRecipient,
  undeliveredAnswers,
  validationAsk,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { isDemoProject } from "../demo/demo-project";
import type { CommandMeta, Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";
import {
  type QuestionImageDeps,
  type QuestionImagesPort,
  questionImagesOf,
} from "../questions/question-images-port";
import { type AgentSource, NEUTRAL_AGENT_SOURCE } from "./neutral-agents";
import type { AgentDataPort } from "./orchestrator";

export function applyRules(doc: LoroDoc, trigger: RuleTrigger): ProjectCommand[] {
  const commands = evaluateRules(readRules(doc), trigger, listTickets(doc));
  for (const command of commands) executeProjectCommand(doc, command);
  return commands;
}

const isShared = (doc: LoroDoc) => getKeyAllocator(doc) === "server";

function domainsOf(docs: Docs, projectId: string) {
  const doc = docs.project(projectId);
  const project = { domains: listProjectDomains(doc), shared: isShared(doc) };
  return domainsOfProject({ project, workspace: listDomains(docs.workspace) });
}

function guidelinesOf(docs: Docs, projectId: string) {
  const doc = docs.project(projectId);
  const own = new Set(listProjectDomains(doc).map((d) => d.id));
  const visible = (g: Guideline) =>
    g.owner.scope !== "domain" || (!isShared(doc) && !own.has(g.owner.domainId));
  const workspace = listGuidelines(docs.workspace).filter(visible);
  return [...workspace, ...listProjectDomainGuidelines(doc), ...listGuidelines(doc)];
}

const FROM_DAEMON: CommandMeta = { origin: "agent", instanceId: null };

type QuestionsPort = Pick<
  AgentDataPort,
  "createQuestion" | "answerRunQuestion" | "runQuestions" | "undeliveredAnswers" | "markAnswersDelivered"
>;

function openOfRun(docs: Docs, projectId: string, runId: string): Question[] {
  return listQuestions(docs.project(projectId)).filter((q) => q.runId === runId && isOpen(q));
}

type RunAuthor = { id: string; profileName: string; cwd?: string | null };

function createRunQuestion(
  docs: Docs,
  images: QuestionImagesPort,
  projectId: string,
  ticketId: string,
  run: RunAuthor,
  input: AskInput,
): Question | null {
  if (openOfRun(docs, projectId, run.id).length >= OPEN_PER_RUN_MAX) return null;
  const ask = input.kind === "validation" ? validationAsk(input) : input;
  const prepared = images.prepare(projectId, run.cwd ?? null, ask.images);
  const created = docs.run(
    projectId,
    {
      method: "createQuestion",
      ticketId,
      title: ask.title,
      context: ask.context,
      options: ask.options,
      provisional: ask.provisional,
      blocking: ask.blocking,
      runId: run.id,
      createdBy: { kind: "agent", ref: run.profileName },
      recipient: resolveRecipient(listQuestionRecipients(docs.project(projectId)), ask.recipient),
      kind: ask.kind,
      images: prepared.map((p) => p.image),
    },
    FROM_DAEMON,
  );
  const question = Question.parse(created);
  images.store(question, prepared);
  return question;
}

function answerRunQuestion(docs: Docs, projectId: string, runId: string, text: string, by: Actor) {
  const blocking = openOfRun(docs, projectId, runId).filter((q) => q.blocking);
  const target = blocking.at(-1);
  if (!target) return null;
  const answered = docs.run(
    projectId,
    { method: "answerQuestion", questionId: target.id, answer: { kind: "text", text }, by },
    FROM_DAEMON,
  );
  return Question.parse(answered);
}

function questionsPort(docs: Docs, now: () => number, imageDeps: QuestionImageDeps | null): QuestionsPort {
  const images = questionImagesOf(
    imageDeps,
    (projectId) => docs.projectMeta(projectId).delivery?.root ?? null,
  );
  return {
    createQuestion: (projectId, ticketId, run, ask) =>
      createRunQuestion(docs, images, projectId, ticketId, run, ask),
    answerRunQuestion: (projectId, runId, text, by) => answerRunQuestion(docs, projectId, runId, text, by),
    runQuestions: () => countOpenByRun(docs.projectIds().flatMap((id) => listQuestions(docs.project(id)))),
    undeliveredAnswers: (projectId, ticketId) =>
      undeliveredAnswers(listQuestions(docs.project(projectId)), ticketId),
    markAnswersDelivered(projectId, ticketId, questionIds, runId) {
      if (questionIds.length === 0) return;
      docs.run(
        projectId,
        { method: "markAnswersDelivered", ticketId, questionIds: [...questionIds], runId, at: now() },
        FROM_DAEMON,
      );
    },
  };
}

export function createDataPort(
  docs: Docs,
  settings: Pick<ProjectSettings, "get">,
  now: () => number = Date.now,
  agentSource: AgentSource = NEUTRAL_AGENT_SOURCE,
  images: QuestionImageDeps | null = null,
): AgentDataPort {
  return {
    ...questionsPort(docs, now, images),
    agents: (projectId) => agentSource.agents(projectId),
    agentOf: (ref) => agentSource.agentOf(ref),
    projectKey: (projectId) => docs.projectMeta(projectId).key,
    skills: (projectId) => agentSource.skills?.(projectId) ?? [],
    ticketContext(projectId, ticketId) {
      const project = {
        ...readProject(docs.project(projectId), docs.activity(projectId)),
        meta: docs.projectMeta(projectId),
      };
      const ticket = project.tickets.find((t) => t.id === ticketId);
      if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${ticketId} not found`);
      const domain = domainsOf(docs, projectId).find((d) => d.id === ticket.domainId) ?? null;
      return { project, ticket, domain };
    },
    guidelines: (projectId) => guidelinesOf(docs, projectId),
    assertWritable: (projectId) => docs.assertWritable(projectId),
    assignTicket(projectId, ticketId, profileName) {
      docs.run(projectId, {
        method: "updateTicket",
        ticketId,
        assignee: { kind: "agent", ref: profileName },
      });
    },
    runStarted(projectId, ticketId) {
      docs.trigger(projectId, { kind: "run_started", ticketId });
    },
    runDone(projectId, ticketId) {
      docs.trigger(projectId, { kind: "run_done", ticketId });
    },
    isDemoProject: (projectId) => isDemoProject(settings, projectId),
  };
}
