import { formatTicketKey, type KeyAllocator, type ProjectSyncInfo } from "@kibo/schema";
import { idStrToId, type LoroDoc, LoroMap, type LoroTreeNode, type TreeID } from "loro-crdt";
import { getProjectMeta } from "./project";
import { getNode, walkDepthFirst } from "./tree";

export type Member = { userId: string; name: string };

const SERVER_ORIGIN = "kibo-server";

export function getKeyAllocator(doc: LoroDoc): KeyAllocator {
  return doc.getMap("meta").get("keyAllocator") === "server" ? "server" : "local";
}

export function nextPendingSeq(doc: LoroDoc): number {
  const suffix = `@${doc.peerIdStr}`;
  let max = 0;
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    if (!node.id.endsWith(suffix)) continue;
    const seq = node.data.get("pendingSeq");
    if (typeof seq === "number" && seq > max) max = seq;
  }
  return max + 1;
}

export function localSyncInfo(doc: LoroDoc): ProjectSyncInfo {
  const keyAllocator = getKeyAllocator(doc);
  return { shared: keyAllocator === "server", keyAllocator, role: null, access: "write", members: [] };
}

const currentTicketSeq = (doc: LoroDoc): number => {
  const seq = doc.getMap("meta").get("ticketSeq");
  return typeof seq === "number" ? seq : 0;
};

const isPending = (node: LoroTreeNode): boolean => (node.data.get("key") ?? null) === null;

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function ticketCreationLamport(doc: LoroDoc, ticketId: string): number {
  const id = idStrToId(ticketId as TreeID);
  const change = doc.getChangeAt(id);
  return change.lamport + (id.counter - change.counter);
}

export function pendingTicketOrder(doc: LoroDoc): string[] {
  return walkDepthFirst(doc.getTree("tickets"))
    .filter(isPending)
    .map((node) => ({ id: node.id, lamport: ticketCreationLamport(doc, node.id) }))
    .sort((a, b) => a.lamport - b.lamport || compareIds(a.id, b.id))
    .map((entry) => entry.id);
}

export function allocateTicketKeys(doc: LoroDoc): { ticketId: string; key: string }[] {
  const order = pendingTicketOrder(doc);
  if (order.length === 0) return [];
  const projectKey = getProjectMeta(doc).key;
  const tickets = doc.getTree("tickets");
  let seq = currentTicketSeq(doc);
  const allocated: { ticketId: string; key: string }[] = [];
  for (const ticketId of order) {
    seq += 1;
    const key = formatTicketKey(projectKey, seq);
    getNode(tickets, ticketId).data.set("key", key);
    allocated.push({ ticketId, key });
  }
  doc.getMap("meta").set("ticketSeq", seq);
  doc.commit({ origin: SERVER_ORIGIN });
  return allocated;
}

export function enableServerAllocation(doc: LoroDoc): number {
  doc.getMap("meta").set("keyAllocator", "server");
  doc.commit({ origin: SERVER_ORIGIN });
  return currentTicketSeq(doc);
}

const nameOf = (entry: unknown): string | null =>
  entry instanceof Object && "name" in entry && typeof entry.name === "string" ? entry.name : null;

export function writeMembers(doc: LoroDoc, members: Member[]): void {
  const directory = doc.getMap("meta").getOrCreateContainer("members", new LoroMap());
  const wanted = new Map(members.map((m) => [m.userId, m.name]));
  for (const userId of directory.keys()) if (!wanted.has(userId)) directory.delete(userId);
  for (const [userId, name] of wanted) {
    if (nameOf(directory.get(userId)) !== name) directory.set(userId, { name });
  }
  doc.commit({ origin: SERVER_ORIGIN });
}

export function readMembers(doc: LoroDoc): Member[] {
  const directory = doc.getMap("meta").get("members");
  if (!(directory instanceof LoroMap)) return [];
  return directory
    .keys()
    .flatMap((userId) => {
      const name = nameOf(directory.get(userId));
      return name === null ? [] : [{ userId, name }];
    })
    .sort((a, b) => compareIds(a.userId, b.userId));
}
