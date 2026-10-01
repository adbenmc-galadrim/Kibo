import { KiboError, type Ticket } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { upsertExternalRef } from "./external-refs";
import { addLink, listLinks } from "./links";
import { createTicket, deleteTicket, getTicket, ticketTree } from "./tickets";
import { getNode, subtreeIds } from "./tree";

export type TransferredTicket = { from: string; to: string; key: string | null };
export type TransferResult = {
  ticketId: string;
  key: string | null;
  created: TransferredTicket[];
  recreatedLinks: number;
  droppedLinks: number;
};

function recreate(to: LoroDoc, source: Ticket, parentId: string | null): Ticket {
  const created = createTicket(to, {
    title: source.title,
    description: source.description,
    statusId: source.statusId,
    blockedReason: source.blockedReason,
    parentId,
    domainId: source.domainId,
    assignee: source.assignee?.kind === "human" ? source.assignee : null,
  });
  return source.externalRefs.reduce((t, ref) => upsertExternalRef(to, t.id, ref), created);
}

function recreateSubtree(
  from: LoroDoc,
  to: LoroDoc,
  ticketId: string,
  parentId: string | null,
): TransferredTicket[] {
  const created: TransferredTicket[] = [];
  const visit = (id: string, targetParent: string | null) => {
    const next = recreate(to, getTicket(from, id), targetParent);
    created.push({ from: id, to: next.id, key: next.key });
    for (const child of getNode(ticketTree(from), id).children() ?? []) visit(child.id, next.id);
  };
  visit(ticketId, parentId);
  return created;
}

function recreateLinks(from: LoroDoc, to: LoroDoc, created: TransferredTicket[]) {
  const mapping = new Map(created.map((c) => [c.from, c.to]));
  let recreatedLinks = 0;
  let droppedLinks = 0;
  for (const link of listLinks(from)) {
    const a = mapping.get(link.from);
    const b = mapping.get(link.to);
    if (a && b) {
      addLink(to, { from: a, to: b, type: link.type });
      recreatedLinks += 1;
    } else if (a || b) droppedLinks += 1;
  }
  return { recreatedLinks, droppedLinks };
}

export function transferTicket(
  from: LoroDoc,
  to: LoroDoc,
  ticketId: string,
  parentId: string | null,
): TransferResult {
  const ids = subtreeIds(getNode(ticketTree(from), ticketId));
  if (parentId !== null) getNode(ticketTree(to), parentId);
  const created = recreateSubtree(from, to, ticketId, parentId);
  const links = recreateLinks(from, to, created);
  deleteTicket(from, ticketId);
  from.commit();
  to.commit();
  const root = created[0];
  if (!root || created.length !== ids.length)
    throw new KiboError("INTERNAL", "transfer did not recreate the subtree");
  return { ticketId: root.to, key: root.key, created, ...links };
}
