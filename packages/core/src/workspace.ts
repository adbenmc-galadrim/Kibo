import { KiboError, ProjectMeta } from "@kibo/schema";
import { LoroDoc, type LoroList, LoroMap } from "loro-crdt";

export function createWorkspaceDoc(): LoroDoc {
  const doc = new LoroDoc();
  doc.getList("projects");
  doc.commit();
  return doc;
}

export function listProjects(ws: LoroDoc): ProjectMeta[] {
  return (ws.getList("projects").toJSON() as ProjectMeta[]).map((p) => ({ ...p }));
}

export function registerProject(ws: LoroDoc, meta: ProjectMeta): void {
  if (!ProjectMeta.safeParse(meta).success)
    throw new KiboError("INVALID_INPUT", `invalid project ${meta.key}`);
  if (listProjects(ws).some((p) => p.key === meta.key || p.id === meta.id)) {
    throw new KiboError("INVALID_INPUT", `project ${meta.key} already exists`);
  }
  const list: LoroList = ws.getList("projects");
  const entry = list.insertContainer(list.length, new LoroMap());
  for (const [k, v] of Object.entries(meta)) entry.set(k, v);
  ws.commit();
}
