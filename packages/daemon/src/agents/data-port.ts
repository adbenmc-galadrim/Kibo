import {
  executeProjectCommand,
  getKeyAllocator,
  listProjectDomainGuidelines,
  listProjectDomains,
  listQuestions,
  listTickets,
  readProject,
} from "@kibo/core";
import { listDomains, listGuidelines, listProfiles } from "@kibo/core/agent-config";
import { evaluateRules, type RuleTrigger, readRules } from "@kibo/core/rules";
import {
  type Actor,
  type AskInput,
  countOpenByRun,
  isOpen,
  KiboError,
  OPEN_PER_RUN_MAX,
  type ProjectCommand,
  Question,
  undeliveredAnswers,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { isDemoProject } from "../demo/demo-project";
import type { CommandMeta, Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";
import type { AgentDataPort } from "./orchestrator";

export function applyRules(doc: LoroDoc, trigger: RuleTrigger): ProjectCommand[] {
  const commands = evaluateRules(readRules(doc), trigger, listTickets(doc));
  for (const command of commands) executeProjectCommand(doc, command);
  return commands;
}

const isShared = (doc: LoroDoc) => getKeyAllocator(doc) === "server";

function domainsOf(docs: Docs, projectId: string) {
  const doc = docs.project(projectId);
  return isShared(doc) ? listProjectDomains(doc) : listDomains(docs.workspace);
}

function guidelinesOf(docs: Docs, projectId: string) {
  const doc = docs.project(projectId);
  const workspace = listGuidelines(docs.workspace);
  if (!isShared(doc)) return [...workspace, ...listGuidelines(doc)];
  const outsideDomains = workspace.filter((g) => g.owner.scope !== "domain");
  return [...outsideDomains, ...listProjectDomainGuidelines(doc), ...listGuidelines(doc)];
}

const FROM_DAEMON: CommandMeta = { origin: "agent", instanceId: null };

type QuestionsPort = Pick<
  AgentDataPort,
  "createQuestion" | "answerRunQuestion" | "runQuestions" | "undeliveredAnswers" | "markAnswersDelivered"
>;

function openOfRun(docs: Docs, projectId: string, runId: string): Question[] {
  return listQuestions(docs.project(projectId)).filter((q) => q.runId === runId && isOpen(q));
}

function createRunQuestion(
  docs: Docs,
  projectId: string,
  ticketId: string,
  run: { id: string; profileName: string },
  ask: AskInput,
): Question | null {
  if (openOfRun(docs, projectId, run.id).length >= OPEN_PER_RUN_MAX) return null;
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
    },
    FROM_DAEMON,
  );
  return Question.parse(created);
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

function questionsPort(docs: Docs, now: () => number): QuestionsPort {
  return {
    createQuestion: (projectId, ticketId, run, ask) => createRunQuestion(docs, projectId, ticketId, run, ask),
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
): AgentDataPort {
  return {
    ...questionsPort(docs, now),
    profiles: () => listProfiles(docs.workspace),
    ticketContext(projectId, ticketId) {
      const project = { ...readProject(docs.project(projectId)), meta: docs.projectMeta(projectId) };
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
