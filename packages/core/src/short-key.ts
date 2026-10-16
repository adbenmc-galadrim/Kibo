import { KiboError, ShortKey } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { valid } from "./config-store";
import { featureSeqOf, setFeatureSeq } from "./project";
import { getNode, walkDepthFirst } from "./tree";

const FEATURE_PREFIX = "F";
const MAX_FEATURE_SEQ = 999;

const tickets = (doc: LoroDoc) => doc.getTree("tickets");

function usedShortKeys(doc: LoroDoc, exceptId: string | null): Set<string> {
  const used = new Set<string>();
  for (const node of walkDepthFirst(tickets(doc))) {
    const key = node.data.get("shortKey");
    if (node.id !== exceptId && typeof key === "string") used.add(key);
  }
  return used;
}

export function allocateShortKey(doc: LoroDoc, ticketId: string): string | null {
  const node = getNode(tickets(doc), ticketId);
  if (node.parent() !== undefined || typeof node.data.get("shortKey") === "string") return null;
  const used = usedShortKeys(doc, ticketId);
  let seq = featureSeqOf(doc) + 1;
  while (used.has(`${FEATURE_PREFIX}${seq}`)) seq += 1;
  if (seq > MAX_FEATURE_SEQ) return null;
  const key = `${FEATURE_PREFIX}${seq}`;
  setFeatureSeq(doc, seq);
  node.data.set("shortKey", key);
  return key;
}

export function checkShortKey(doc: LoroDoc, ticketId: string, shortKey: string | null): string | null {
  if (shortKey === null) return null;
  const key = valid(ShortKey.safeParse(shortKey));
  if (usedShortKeys(doc, ticketId).has(key))
    throw new KiboError("CONFLICT", `short key ${key} is already taken`);
  return key;
}
