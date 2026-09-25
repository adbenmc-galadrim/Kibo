import { KiboError, type Link } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { getNode } from "./tree";

const links = (doc: LoroDoc) => doc.getMap("links");

export function listLinks(doc: LoroDoc): Link[] {
  return Object.values(links(doc).toJSON() as Record<string, Link>);
}

function reaches(all: Link[], start: string, goal: string): boolean {
  const queue = [start];
  const seen = new Set<string>();
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (id === goal) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const l of all) if (l.type === "blocks" && l.from === id) queue.push(l.to);
  }
  return false;
}

export function addLink(doc: LoroDoc, input: Omit<Link, "id">): Link {
  const tickets = doc.getTree("tickets");
  getNode(tickets, input.from);
  getNode(tickets, input.to);
  if (input.from === input.to) throw new KiboError("INVALID_INPUT", "a ticket cannot link to itself");
  const all = listLinks(doc);
  const same = (l: Link) =>
    l.type === input.type &&
    ((l.from === input.from && l.to === input.to) ||
      (input.type === "relates" && l.from === input.to && l.to === input.from));
  if (all.some(same)) throw new KiboError("INVALID_INPUT", "link already exists");
  if (input.type === "blocks" && reaches(all, input.to, input.from)) {
    throw new KiboError("LINK_CYCLE", "this dependency would create a cycle");
  }
  const link: Link = { id: crypto.randomUUID(), ...input };
  links(doc).set(link.id, link);
  doc.commit();
  return link;
}

export function removeLink(doc: LoroDoc, id: string): void {
  if (links(doc).get(id) === undefined) throw new KiboError("NOT_FOUND", `link ${id} not found`);
  links(doc).delete(id);
  doc.commit();
}

export function pruneLinks(doc: LoroDoc, ticketIds: string[]): void {
  const gone = new Set(ticketIds);
  for (const l of listLinks(doc)) if (gone.has(l.from) || gone.has(l.to)) links(doc).delete(l.id);
  doc.commit();
}

export function waitingOn(doc: LoroDoc, ticketId: string): string[] {
  const tickets = doc.getTree("tickets");
  return listLinks(doc)
    .filter((l) => l.type === "blocks" && l.to === ticketId)
    .map((l) => getNode(tickets, l.from).data)
    .filter((data) => data.get("statusId") !== "done")
    .map((data) => data.get("key") as string);
}
