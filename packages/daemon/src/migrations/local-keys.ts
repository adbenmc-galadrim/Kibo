import { assignShortKey, getNode, getProjectMeta, nextFeatureSlot, walkDepthFirst } from "@kibo/core";
import { formatTicketKey, KiboError, type ProjectEventSink } from "@kibo/schema";
import { idStrToId, type LoroDoc, type LoroTreeNode, type TreeID } from "loro-crdt";
import type { Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";

export const LOCAL_KEYS_MARKER = "localKeysRestoredAt";

type Allocated = { ticketId: string; key: string };

const serverAllocated = (doc: LoroDoc): boolean => doc.getMap("meta").get("keyAllocator") === "server";

const isPending = (node: LoroTreeNode): boolean => (node.data.get("key") ?? null) === null;

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function ticketCreationLamport(doc: LoroDoc, ticketId: string): number {
  const id = idStrToId(ticketId as TreeID);
  const change = doc.getChangeAt(id);
  return change.lamport + (id.counter - change.counter);
}

function pendingTicketOrder(doc: LoroDoc): string[] {
  return walkDepthFirst(doc.getTree("tickets"))
    .filter(isPending)
    .map((node) => ({ id: node.id, lamport: ticketCreationLamport(doc, node.id) }))
    .sort((a, b) => a.lamport - b.lamport || compareIds(a.id, b.id))
    .map((entry) => entry.id);
}

function currentTicketSeq(doc: LoroDoc): number {
  const seq = doc.getMap("meta").get("ticketSeq");
  if (typeof seq === "number" && Number.isInteger(seq) && seq >= 0) return seq;
  throw new KiboError("STORE_CORRUPT", "meta.ticketSeq is not a sequence number");
}

function featureKey(doc: LoroDoc, node: LoroTreeNode): string | null {
  if (node.data.get("feature") !== true || node.parent() !== undefined) return null;
  const slot = nextFeatureSlot(doc, node.id);
  assignShortKey(doc, { ticketId: node.id, ...slot });
  return slot.key;
}

export function allocatePendingKeys(doc: LoroDoc): Allocated[] {
  const order = pendingTicketOrder(doc);
  if (order.length === 0) return [];
  const projectKey = getProjectMeta(doc).key;
  const tickets = doc.getTree("tickets");
  let seq = currentTicketSeq(doc);
  const allocated: Allocated[] = [];
  for (const ticketId of order) {
    const node = getNode(tickets, ticketId);
    let key = featureKey(doc, node);
    if (key === null) {
      seq += 1;
      key = formatTicketKey(projectKey, seq);
    }
    node.data.set("key", key);
    allocated.push({ ticketId, key });
  }
  doc.getMap("meta").set("ticketSeq", seq);
  doc.commit();
  return allocated;
}

function forgetSharing(doc: LoroDoc): void {
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    if (typeof node.data.get("pendingSeq") === "number") node.data.set("pendingSeq", null);
  }
  const meta = doc.getMap("meta");
  meta.delete("keyAllocator");
  meta.delete("members");
  doc.commit();
}

export function restoreLocalKeysOnce(
  doc: LoroDoc,
  settings: Pick<ProjectSettings, "get" | "set">,
  projectId: string,
  now: () => number,
): Allocated[] | null {
  if (settings.get(projectId, LOCAL_KEYS_MARKER) !== null) return null;
  const server = serverAllocated(doc);
  const allocated = server ? allocatePendingKeys(doc) : [];
  if (server || doc.getMap("meta").get("members") !== undefined) forgetSharing(doc);
  settings.set(projectId, LOCAL_KEYS_MARKER, new Date(now()).toISOString());
  return allocated;
}

export type LocalKeysDeps = {
  docs: Pick<Docs, "project" | "projectIds" | "save" | "emit">;
  settings: Pick<ProjectSettings, "get" | "set">;
  sink: ProjectEventSink;
  now: () => number;
};

export function restoreLocalKeys(deps: LocalKeysDeps): void {
  for (const projectId of deps.docs.projectIds()) {
    const doc = deps.docs.project(projectId);
    const before = JSON.stringify(doc.frontiers());
    const allocated = restoreLocalKeysOnce(doc, deps.settings, projectId, deps.now);
    if (allocated === null || JSON.stringify(doc.frontiers()) === before) continue;
    deps.docs.save(projectId);
    deps.docs.emit({ projectId });
    deps.sink.record(projectId, {
      kind: "keys_assigned",
      ticketId: null,
      featureId: null,
      source: "kibo",
      data: { count: allocated.length },
    });
  }
}
