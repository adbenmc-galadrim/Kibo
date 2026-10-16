import {
  KiboError,
  NO_ACTIVITY,
  type ProjectActivity,
  type ProjectCommand,
  type ProjectSnapshot,
  type StatusId,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { addBinding, listBindings, removeBinding } from "./bindings";
import { importExternalTicket, removeExternalRef, upsertExternalRef } from "./external-refs";
import { writeInstanceData } from "./instance-data";
import {
  addInstance,
  listInstances,
  removeInstance,
  setInstanceComponent,
  setInstanceConfig,
  setInstanceLayout,
  setPageLayout,
} from "./instances";
import { localSyncInfo } from "./keys";
import { addLink, listLinks, removeLink } from "./links";
import { addPage, deletePage, listPages, movePage, renamePage } from "./pages";
import { getProjectMeta, getWorkflow, peekTicketKey } from "./project";
import { listProjectDomains } from "./project-domains";
import {
  addQuestionRecipient,
  listQuestionRecipients,
  markQuestionSent,
  removeQuestionRecipient,
  renameQuestionRecipient,
  setQuestionRecipient,
} from "./question-recipients";
import {
  answerQuestion,
  createQuestion,
  listQuestions,
  markAnswersDelivered,
  removeQuestion,
} from "./questions";
import {
  archiveQuestion,
  reopenQuestion,
  restoreQuestion,
  updateAnswer,
  updateQuestion,
} from "./questions-edit";
import { readRules } from "./rules";
import {
  createSprint,
  deleteSprint,
  listSprints,
  setTicketSprint,
  sprintViews,
  updateSprint,
} from "./sprints";
import { ticketViews } from "./ticket-views";
import {
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  moveTicket,
  setStatus,
  setTicketDelivery,
  setTicketOptional,
  setTicketProgress,
  updateTicket,
} from "./tickets";

export const UNDATED = "0000-01-01";

export function executeProjectCommand(doc: LoroDoc, cmd: ProjectCommand): unknown {
  switch (cmd.method) {
    case "addPage":
      return addPage(doc, { title: cmd.title, kind: cmd.kind, parentId: cmd.parentId ?? null });
    case "renamePage":
      renamePage(doc, cmd.pageId, cmd.title);
      return null;
    case "movePage":
      movePage(doc, cmd.pageId, cmd.parentId, cmd.index);
      return null;
    case "deletePage":
      return deletePage(doc, cmd.pageId);
    case "createTicket": {
      const { method: _method, ...input } = cmd;
      return createTicket(doc, input);
    }
    case "updateTicket": {
      const { method: _method, ticketId, ...patch } = cmd;
      return updateTicket(doc, ticketId, patch);
    }
    case "setStatus":
      return setStatus(doc, cmd.ticketId, cmd.statusId, cmd.reason);
    case "moveTicket":
      moveTicket(doc, cmd.ticketId, cmd.parentId, cmd.index);
      return null;
    case "deleteTicket":
      return deleteTicket(doc, cmd.ticketId);
    case "addLink":
      return addLink(doc, { from: cmd.from, to: cmd.to, type: cmd.type });
    case "removeLink":
      removeLink(doc, cmd.linkId);
      return null;
    case "addInstance": {
      const { method: _method, ...input } = cmd;
      return addInstance(doc, input);
    }
    case "removeInstance":
      removeInstance(doc, cmd.instanceId);
      return null;
    case "upsertExternalRef":
      return upsertExternalRef(doc, cmd.ticketId, cmd.ref);
    case "removeExternalRef":
      return removeExternalRef(doc, { ticketId: cmd.ticketId, kind: cmd.kind, key: cmd.key });
    case "addBinding":
      return addBinding(doc, cmd.binding);
    case "removeBinding":
      removeBinding(doc, cmd.bindingId);
      return null;
    case "importExternalTicket": {
      const { method: _method, ...input } = cmd;
      return importExternalTicket(doc, input);
    }
    case "setInstanceComponent": {
      const { method: _method, ...input } = cmd;
      return setInstanceComponent(doc, input);
    }
    case "setInstanceConfig":
      return setInstanceConfig(doc, cmd.instanceId, cmd.config);
    case "setInstanceLayout":
      return setInstanceLayout(doc, cmd.instanceId, cmd.layout);
    case "setPageLayout":
      return setPageLayout(doc, cmd.pageId, cmd.layouts);
    case "setInstanceData":
      writeInstanceData(doc, cmd.instanceId, cmd.key, cmd.value);
      return null;
    case "createQuestion": {
      const { method: _method, ...input } = cmd;
      return createQuestion(doc, input);
    }
    case "answerQuestion":
      return answerQuestion(doc, cmd.questionId, cmd.answer, cmd.by, cmd.at ?? Date.now());
    case "removeQuestion":
      removeQuestion(doc, cmd.questionId);
      return null;
    case "markAnswersDelivered": {
      const { method: _method, ...mark } = cmd;
      return markAnswersDelivered(doc, mark);
    }
    case "setTicketProgress": {
      const { method: _method, ...update } = cmd;
      return setTicketProgress(doc, update);
    }
    case "setTicketDelivery":
      return setTicketDelivery(doc, cmd.ticketId, cmd.delivery);
    case "addQuestionRecipient":
      return addQuestionRecipient(doc, cmd.name, crypto.randomUUID());
    case "renameQuestionRecipient":
      return renameQuestionRecipient(doc, cmd.recipientId, cmd.name);
    case "removeQuestionRecipient":
      return removeQuestionRecipient(doc, cmd.recipientId);
    case "setQuestionRecipient":
      return setQuestionRecipient(doc, cmd.questionId, cmd.recipient);
    case "markQuestionSent":
      return markQuestionSent(doc, cmd.questionId, cmd.at ?? Date.now());
    case "updateQuestion":
      return updateQuestion(doc, cmd);
    case "updateAnswer":
      return updateAnswer(doc, cmd);
    case "reopenQuestion":
      return reopenQuestion(doc, cmd);
    case "archiveQuestion":
      return archiveQuestion(doc, cmd);
    case "restoreQuestion":
      return restoreQuestion(doc, cmd);
    case "createSprint":
      return createSprint(doc, { name: cmd.name, start: cmd.start, end: cmd.end });
    case "updateSprint":
      return updateSprint(doc, cmd.sprintId, cmd.patch);
    case "deleteSprint":
      return deleteSprint(doc, cmd.sprintId);
    case "setTicketSprint":
      setTicketSprint(doc, cmd.ticketId, cmd.sprintId);
      return getTicket(doc, cmd.ticketId);
    case "setTicketOptional":
      return setTicketOptional(doc, cmd.ticketId, cmd.optional);
  }
}

const DAEMON_ONLY_COMMANDS: ReadonlySet<ProjectCommand["method"]> = new Set([
  "setInstanceComponent",
  "setInstanceData",
  "markAnswersDelivered",
  "setTicketProgress",
  "setTicketDelivery",
]);

export function assertShellCommand(cmd: ProjectCommand): void {
  if (DAEMON_ONLY_COMMANDS.has(cmd.method)) {
    throw new KiboError("PERMISSION_DENIED", `command ${cmd.method} is reserved to the daemon`);
  }
}

export function readProject(
  doc: LoroDoc,
  activity: ProjectActivity = NO_ACTIVITY,
  today: string = UNDATED,
): ProjectSnapshot {
  const meta = getProjectMeta(doc);
  const questions = listQuestions(doc);
  const links = listLinks(doc);
  const sprints = listSprints(doc);
  const tickets = ticketViews(
    { projectKey: meta.key, tickets: listTickets(doc), links, questions, sprints, today },
    activity,
  );
  return {
    meta,
    workflow: getWorkflow(doc),
    pages: listPages(doc),
    tickets,
    links,
    questions,
    questionRecipients: listQuestionRecipients(doc),
    instances: listInstances(doc),
    rules: readRules(doc),
    bindings: listBindings(doc),
    nextTicketKey: peekTicketKey(doc),
    sync: localSyncInfo(doc),
    domains: listProjectDomains(doc),
    sprints: sprintViews(sprints, tickets, today),
  };
}

export function countTicketsByStatus(doc: LoroDoc): Record<StatusId, number> {
  const counts: Record<StatusId, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    blocked: 0,
    done: 0,
  };
  for (const t of listTickets(doc)) counts[t.statusId] += 1;
  return counts;
}
