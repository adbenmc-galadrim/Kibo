import {
  DEFAULT_DUPLICATION_SETTINGS,
  DEFAULT_WORKFLOW,
  DUPLICATION_SHARED_GLOBS,
  type DuplicationSettings,
  type EffectiveDuplication,
  formatTicketKey,
  ProjectMeta,
  ProjectPatch,
  type Status,
} from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import { z } from "zod";
import { stored, valid } from "./config-store";
import type { RegisteredProjectPatch } from "./workspace";

export const LOCAL_ONLY_META: ReadonlySet<string> = new Set([
  "worktree",
  "storybook",
  "duplication",
  "delivery",
]);

const hasShared = (settings: DuplicationSettings): settings is EffectiveDuplication =>
  settings.shared !== undefined;

export function effectiveDuplication(meta: {
  duplication: DuplicationSettings | null;
}): EffectiveDuplication {
  const settings = meta.duplication ?? DEFAULT_DUPLICATION_SETTINGS;
  return hasShared(settings) ? settings : { ...settings, shared: [...DUPLICATION_SHARED_GLOBS] };
}

export const sharedMetaEntries = (meta: ProjectMeta): [string, ProjectMeta[keyof ProjectMeta]][] =>
  Object.entries(meta).filter(([key]) => !LOCAL_ONLY_META.has(key));

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
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: stored(ProjectMeta.shape.tracking.safeParse(m.get("tracking") ?? null), "project tracking"),
  };
}

export function setProjectMeta(doc: LoroDoc, patch: RegisteredProjectPatch): ProjectMeta {
  const fields = valid(ProjectPatch.safeParse(patch));
  const m = doc.getMap("meta");
  if (fields.name !== undefined) m.set("name", fields.name);
  if (fields.color !== undefined) m.set("color", fields.color);
  if (fields.folder !== undefined) m.set("folder", fields.folder);
  if (fields.tracking !== undefined) m.set("tracking", fields.tracking);
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

export const FeatureSeq = z.number().int().nonnegative().optional();

export const featureSeqOf = (doc: LoroDoc): number =>
  (doc.getMap("meta").get("featureSeq") as number | undefined) ?? 0;

export const setFeatureSeq = (doc: LoroDoc, seq: number): void => {
  doc.getMap("meta").set("featureSeq", seq);
};

export function nextTicketSeq(doc: LoroDoc): number {
  const next = upcomingSeq(doc);
  doc.getMap("meta").set("ticketSeq", next);
  doc.commit();
  return next;
}
