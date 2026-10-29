import { KiboError, ShortKey } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { valid } from "./config-store";
import { featureSeqOf, setFeatureSeq } from "./project";
import { getNode, walkDepthFirst } from "./tree";

const FEATURE_PREFIX = "F";
export const MAX_FEATURE_SEQ = 999;

const tickets = (doc: LoroDoc) => doc.getTree("tickets");

export function usedShortKeys(doc: LoroDoc, exceptId: string | null): Set<string> {
  const used = new Set<string>();
  for (const node of walkDepthFirst(tickets(doc))) {
    const key = node.data.get("shortKey");
    if (node.id !== exceptId && typeof key === "string") used.add(key);
  }
  return used;
}

export type FeatureSlot = { key: string; seq: number };
export type ShortKeyAllocation = FeatureSlot & { ticketId: string };

export function freeFeatureSeq(doc: LoroDoc, exceptId: string | null): number {
  const used = usedShortKeys(doc, exceptId);
  let seq = featureSeqOf(doc) + 1;
  while (used.has(`${FEATURE_PREFIX}${seq}`)) seq += 1;
  return seq;
}

export function nextFeatureSlot(doc: LoroDoc, exceptId: string | null): FeatureSlot {
  const seq = freeFeatureSeq(doc, exceptId);
  if (seq > MAX_FEATURE_SEQ)
    throw new KiboError("INVALID_INPUT", `no short key left after ${FEATURE_PREFIX}${MAX_FEATURE_SEQ}`);
  return { key: `${FEATURE_PREFIX}${seq}`, seq };
}

export function nextShortKey(doc: LoroDoc, ticketId: string): ShortKeyAllocation | null {
  const node = getNode(tickets(doc), ticketId);
  if (node.parent() !== undefined || typeof node.data.get("shortKey") === "string") return null;
  return { ticketId, ...nextFeatureSlot(doc, ticketId) };
}

export function assignShortKey(doc: LoroDoc, allocation: ShortKeyAllocation | null): void {
  if (allocation === null) return;
  setFeatureSeq(doc, allocation.seq);
  getNode(tickets(doc), allocation.ticketId).data.set("shortKey", allocation.key);
}

export function allocateShortKey(doc: LoroDoc, ticketId: string): string | null {
  const allocation = nextShortKey(doc, ticketId);
  assignShortKey(doc, allocation);
  return allocation?.key ?? null;
}

export function checkShortKey(doc: LoroDoc, ticketId: string, shortKey: string | null): string | null {
  if (shortKey === null) return null;
  const key = valid(ShortKey.safeParse(shortKey));
  if (usedShortKeys(doc, ticketId).has(key))
    throw new KiboError("CONFLICT", `short key ${key} is already taken`);
  return key;
}
