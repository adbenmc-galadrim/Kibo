import { KiboError, ProjectMeta, ProjectPatch } from "@kibo/schema";
import { LoroDoc, type LoroList, LoroMap } from "loro-crdt";
import { stored, valid } from "./config-store";
import { LOCAL_ONLY_META, sharedMetaEntries } from "./project";

export function createWorkspaceDoc(): LoroDoc {
  const doc = new LoroDoc();
  doc.getList("projects");
  doc.commit();
  return doc;
}

export function listProjects(ws: LoroDoc): ProjectMeta[] {
  return (ws.getList("projects").toJSON() as ProjectMeta[]).map((p) => ({ ...p, worktree: null }));
}

export function registerProject(ws: LoroDoc, meta: ProjectMeta): void {
  if (!ProjectMeta.safeParse(meta).success)
    throw new KiboError("INVALID_INPUT", `invalid project ${meta.key}`);
  if (listProjects(ws).some((p) => p.key === meta.key || p.id === meta.id)) {
    throw new KiboError("INVALID_INPUT", `project ${meta.key} already exists`);
  }
  const list: LoroList = ws.getList("projects");
  const entry = list.insertContainer(list.length, new LoroMap());
  for (const [k, v] of sharedMetaEntries(meta)) entry.set(k, v);
  ws.commit();
}

export type RegisteredProjectPatch = { name?: string; color?: string; folder?: string | null };

function entryOf(ws: LoroDoc, projectId: string): { list: LoroList; index: number } {
  const list: LoroList = ws.getList("projects");
  const index = listProjects(ws).findIndex((p) => p.id === projectId);
  if (index < 0) throw new KiboError("NOT_FOUND", `project ${projectId} not found`);
  return { list, index };
}

export function updateRegisteredProject(
  ws: LoroDoc,
  projectId: string,
  patch: RegisteredProjectPatch,
): ProjectMeta {
  const fields = valid(ProjectPatch.safeParse(patch));
  const { list, index } = entryOf(ws, projectId);
  const entry = list.get(index);
  if (!(entry instanceof LoroMap))
    throw new KiboError("STORE_CORRUPT", `project ${projectId} entry is not a map`);
  for (const [key, value] of Object.entries(fields))
    if (value !== undefined && key !== LOCAL_ONLY_META) entry.set(key, value);
  ws.commit();
  return stored(ProjectMeta.safeParse(listProjects(ws)[index]), "project");
}

export function unregisterProject(ws: LoroDoc, projectId: string): void {
  const { list, index } = entryOf(ws, projectId);
  list.delete(index, 1);
  ws.commit();
}
