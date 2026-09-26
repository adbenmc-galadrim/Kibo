import type { KeyAllocator, ProjectSyncInfo } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { walkDepthFirst } from "./tree";

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
