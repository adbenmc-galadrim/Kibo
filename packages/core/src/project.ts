import { DEFAULT_WORKFLOW, formatTicketKey, type ProjectMeta, type Status } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";

export function createProjectDoc(meta: ProjectMeta): LoroDoc {
  const doc = new LoroDoc();
  const m = doc.getMap("meta");
  for (const [k, v] of Object.entries(meta)) m.set(k, v);
  m.set("ticketSeq", 0);
  doc.getMap("workflow").set("statuses", DEFAULT_WORKFLOW);
  doc.getTree("pages").enableFractionalIndex(0);
  doc.getTree("tickets").enableFractionalIndex(0);
  doc.commit();
  return doc;
}

export function getProjectMeta(doc: LoroDoc): ProjectMeta {
  const m = doc.getMap("meta");
  return {
    id: m.get("id") as string,
    key: m.get("key") as string,
    name: m.get("name") as string,
    folder: (m.get("folder") as string | null) ?? null,
    color: m.get("color") as string,
  };
}

export function getWorkflow(doc: LoroDoc): Status[] {
  return doc.getMap("workflow").get("statuses") as Status[];
}

const upcomingSeq = (doc: LoroDoc): number =>
  ((doc.getMap("meta").get("ticketSeq") as number | undefined) ?? 0) + 1;

export function peekTicketKey(doc: LoroDoc): string | null {
  if (doc.getMap("meta").get("keyAllocator") === "server") return null;
  return formatTicketKey(getProjectMeta(doc).key, upcomingSeq(doc));
}

export function nextTicketSeq(doc: LoroDoc): number {
  const next = upcomingSeq(doc);
  doc.getMap("meta").set("ticketSeq", next);
  doc.commit();
  return next;
}
