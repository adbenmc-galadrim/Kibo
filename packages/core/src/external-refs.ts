import {
  type Assignee,
  ExternalRef,
  type ExternalRefKind,
  externalRefKey,
  externalRefTarget,
  KiboError,
  type StatusId,
  type Ticket,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createTicket, getTicket, listTickets, readExternalRefs } from "./tickets";
import { getNode } from "./tree";

export type ImportedTicket = {
  title: string;
  description?: string;
  statusId?: StatusId;
  assignee?: Assignee | null;
  ref: ExternalRef;
};

const tree = (doc: LoroDoc) => doc.getTree("tickets");

const sameRef = (a: ExternalRef, b: ExternalRef) =>
  a.kind === b.kind && externalRefKey(a) === externalRefKey(b);

function validRef(ref: ExternalRef): ExternalRef {
  const parsed = ExternalRef.safeParse(ref);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid external ref: ${parsed.error.message}`);
  return parsed.data;
}

export function upsertExternalRef(doc: LoroDoc, ticketId: string, ref: ExternalRef): Ticket {
  const parsed = validRef(ref);
  const node = getNode(tree(doc), ticketId);
  const refs = readExternalRefs(node);
  const index = refs.findIndex((r) => sameRef(r, parsed));
  node.data.set(
    "externalRefs",
    index === -1 ? [...refs, parsed] : refs.map((r, i) => (i === index ? parsed : r)),
  );
  doc.commit();
  return getTicket(doc, ticketId);
}

export function removeExternalRef(
  doc: LoroDoc,
  input: { ticketId: string; kind: ExternalRefKind; key: string },
): Ticket {
  const node = getNode(tree(doc), input.ticketId);
  const refs = readExternalRefs(node);
  const next = refs.filter((r) => !(r.kind === input.kind && externalRefKey(r) === input.key));
  if (next.length === refs.length) throw new KiboError("NOT_FOUND", `no ${input.kind} ref ${input.key}`);
  node.data.set("externalRefs", next);
  doc.commit();
  return getTicket(doc, input.ticketId);
}

export function findTicketByRef(doc: LoroDoc, ref: ExternalRef): Ticket | null {
  const target = externalRefTarget(ref);
  if (target === null) return null;
  return listTickets(doc).find((t) => t.externalRefs.some((r) => externalRefTarget(r) === target)) ?? null;
}

export function importExternalTicket(doc: LoroDoc, input: ImportedTicket): Ticket {
  const ref = validRef(input.ref);
  const existing = findTicketByRef(doc, ref);
  if (existing) return existing;
  const statusId = input.statusId === "blocked" ? "todo" : input.statusId;
  const ticket = createTicket(doc, {
    title: input.title,
    description: input.description,
    statusId,
    assignee: input.assignee,
  });
  return upsertExternalRef(doc, ticket.id, ref);
}
