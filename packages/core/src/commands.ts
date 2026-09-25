import type { ProjectCommand, ProjectSnapshot } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { addInstance, listInstances, removeInstance } from "./instances";
import { addLink, listLinks, removeLink, waitingOn } from "./links";
import { addPage, deletePage, listPages, movePage, renamePage } from "./pages";
import { getProjectMeta, getWorkflow } from "./project";
import {
  childProgress,
  createTicket,
  deleteTicket,
  listTickets,
  moveTicket,
  setStatus,
  updateTicket,
} from "./tickets";

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
  }
}

export function readProject(doc: LoroDoc): ProjectSnapshot {
  return {
    meta: getProjectMeta(doc),
    workflow: getWorkflow(doc),
    pages: listPages(doc),
    tickets: listTickets(doc).map((t) => ({
      ...t,
      progress: childProgress(doc, t.id),
      waitingOn: waitingOn(doc, t.id),
    })),
    links: listLinks(doc),
    instances: listInstances(doc),
  };
}
