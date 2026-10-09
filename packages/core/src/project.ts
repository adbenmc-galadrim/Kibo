import { DEFAULT_WORKFLOW, formatTicketKey, type ProjectMeta, ProjectPatch, type Status } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import { valid } from "./config-store";
import type { RegisteredProjectPatch } from "./workspace";

export const LOCAL_ONLY_META = "worktree";

export const sharedMetaEntries = (meta: ProjectMeta): [string, ProjectMeta[keyof ProjectMeta]][] =>
  Object.entries(meta).filter(([key]) => key !== LOCAL_ONLY_META);

export function createProjectDoc(meta: ProjectMeta): LoroDoc {
  const doc = new LoroDoc();
  const m = doc.getMap("meta");
  for (const [k, v] of sharedMetaEntries(meta)) m.set(k, v);
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
    worktree: null,
  };
}

export function setProjectMeta(doc: LoroDoc, patch: RegisteredProjectPatch): ProjectMeta {
  const fields = valid(ProjectPatch.safeParse(patch));
  const m = doc.getMap("meta");
  if (fields.name !== undefined) m.set("name", fields.name);
  if (fields.color !== undefined) m.set("color", fields.color);
  if (fields.folder !== undefined) m.set("folder", fields.folder);
  doc.commit();
  return getProjectMeta(doc);
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
