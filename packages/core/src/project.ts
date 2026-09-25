import { DEFAULT_WORKFLOW, type ProjectMeta, type Status } from "@kibo/schema";
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

export function nextTicketSeq(doc: LoroDoc): number {
  const m = doc.getMap("meta");
  const next = ((m.get("ticketSeq") as number | undefined) ?? 0) + 1;
  m.set("ticketSeq", next);
  doc.commit();
  return next;
}
