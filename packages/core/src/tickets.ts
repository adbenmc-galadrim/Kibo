import {
  type Assignee,
  ExternalRef,
  formatTicketKey,
  KiboError,
  type StatusId,
  type Ticket,
} from "@kibo/schema";
import { type LoroDoc, LoroText, type LoroTreeNode, type TreeID } from "loro-crdt";
import { pruneLinks } from "./links";
import { getProjectMeta, nextTicketSeq } from "./project";
import { getNode, moveNode, subtreeIds, walkDepthFirst } from "./tree";

export type NewTicket = {
  title: string;
  description?: string;
  statusId?: StatusId;
  parentId?: string | null;
  assignee?: Assignee | null;
  domainId?: string | null;
};
export type TicketPatch = {
  title?: string;
  description?: string;
  domainId?: string | null;
  assignee?: Assignee | null;
};

const tree = (doc: LoroDoc) => doc.getTree("tickets");

const RefList = ExternalRef.array();

export function readExternalRefs(node: LoroTreeNode): ExternalRef[] {
  const raw = node.data.get("externalRefs");
  if (raw === undefined || raw === null) return [];
  const parsed = RefList.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid external refs on ${node.id}`);
  return parsed.data;
}

const cleanTitle = (title: string): string => {
  const t = title.trim();
  if (!t) throw new KiboError("INVALID_INPUT", "ticket title is empty");
  return t;
};

function readTicket(n: LoroTreeNode): Ticket {
  const d = n.data;
  const text = d.get("description");
  return {
    id: n.id,
    key: d.get("key") as string,
    title: d.get("title") as string,
    description: text instanceof LoroText ? text.toString() : "",
    statusId: d.get("statusId") as StatusId,
    blockedReason: (d.get("blockedReason") as string | null | undefined) ?? null,
    domainId: (d.get("domainId") as string | null | undefined) ?? null,
    assignee: (d.get("assignee") as Assignee | null | undefined) ?? null,
    parentId: n.parent()?.id ?? null,
    externalRefs: readExternalRefs(n),
  };
}

function writeDescription(n: LoroTreeNode, value: string): void {
  const text = n.data.getOrCreateContainer("description", new LoroText());
  if (text.length > 0) text.delete(0, text.length);
  if (value) text.insert(0, value);
}

export function createTicket(doc: LoroDoc, input: NewTicket): Ticket {
  if (input.statusId === "blocked") {
    throw new KiboError("BLOCKED_REASON_REQUIRED", "create the ticket first, then block it with a reason");
  }
  const title = cleanTitle(input.title);
  const parent = input.parentId ? getNode(tree(doc), input.parentId) : undefined;
  const key = formatTicketKey(getProjectMeta(doc).key, nextTicketSeq(doc));
  const node = parent ? parent.createNode() : tree(doc).createNode();
  node.data.set("key", key);
  node.data.set("title", title);
  node.data.set("statusId", input.statusId ?? "todo");
  node.data.set("blockedReason", null);
  node.data.set("domainId", input.domainId ?? null);
  node.data.set("assignee", input.assignee ?? null);
  node.data.set("externalRefs", []);
  writeDescription(node, input.description ?? "");
  doc.commit();
  return readTicket(node);
}

export function getTicket(doc: LoroDoc, id: string): Ticket {
  return readTicket(getNode(tree(doc), id));
}

export function listTickets(doc: LoroDoc): Ticket[] {
  return walkDepthFirst(tree(doc)).map(readTicket);
}

export function updateTicket(doc: LoroDoc, id: string, patch: TicketPatch): Ticket {
  const node = getNode(tree(doc), id);
  if (patch.title !== undefined) node.data.set("title", cleanTitle(patch.title));
  if (patch.description !== undefined) writeDescription(node, patch.description);
  if (patch.domainId !== undefined) node.data.set("domainId", patch.domainId);
  if (patch.assignee !== undefined) node.data.set("assignee", patch.assignee);
  doc.commit();
  return readTicket(node);
}

export function setStatus(doc: LoroDoc, id: string, statusId: StatusId, reason?: string): Ticket {
  const node = getNode(tree(doc), id);
  if (statusId === "blocked") {
    const r = reason?.trim() ?? "";
    if (!r) throw new KiboError("BLOCKED_REASON_REQUIRED", "a blocked ticket needs a reason");
    node.data.set("blockedReason", r);
  } else {
    node.data.set("blockedReason", null);
  }
  node.data.set("statusId", statusId);
  doc.commit();
  return readTicket(node);
}

export function moveTicket(doc: LoroDoc, id: string, parentId: string | null, index?: number): void {
  moveNode(tree(doc), id, parentId, index);
  doc.commit();
}

export function deleteTicket(doc: LoroDoc, id: string): string[] {
  const ids = subtreeIds(getNode(tree(doc), id));
  tree(doc).delete(id as TreeID);
  pruneLinks(doc, ids);
  return ids;
}

export function childProgress(doc: LoroDoc, id: string): { done: number; total: number } {
  const children = getNode(tree(doc), id).children() ?? [];
  return { done: children.filter((c) => c.data.get("statusId") === "done").length, total: children.length };
}
