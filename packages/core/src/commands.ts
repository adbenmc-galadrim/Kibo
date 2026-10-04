import {
  KiboError,
  type ProjectCommand,
  type ProjectSnapshot,
  type StatusId,
  ticketKeyLabel,
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
import { addLink, listLinks, removeLink, waitingOn } from "./links";
import { addPage, deletePage, listPages, movePage, renamePage } from "./pages";
import { getProjectMeta, getWorkflow, peekTicketKey } from "./project";
import { readRules } from "./rules";
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
  }
}

const DAEMON_ONLY_COMMANDS: ReadonlySet<ProjectCommand["method"]> = new Set([
  "setInstanceComponent",
  "setInstanceData",
]);

export function assertShellCommand(cmd: ProjectCommand): void {
  if (DAEMON_ONLY_COMMANDS.has(cmd.method)) {
    throw new KiboError("PERMISSION_DENIED", `command ${cmd.method} is reserved to the daemon`);
  }
}

export function readProject(doc: LoroDoc): ProjectSnapshot {
  const meta = getProjectMeta(doc);
  return {
    meta,
    workflow: getWorkflow(doc),
    pages: listPages(doc),
    tickets: listTickets(doc).map((t) => ({
      ...t,
      progress: childProgress(doc, t.id),
      waitingOn: waitingOn(doc, t.id),
      keyLabel: ticketKeyLabel(t, meta.key),
    })),
    links: listLinks(doc),
    instances: listInstances(doc),
    rules: readRules(doc),
    bindings: listBindings(doc),
    nextTicketKey: peekTicketKey(doc),
    sync: localSyncInfo(doc),
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
