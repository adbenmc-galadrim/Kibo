import { getProjectMeta } from "@kibo/core";
import { KiboError, type ProjectAccess, type ProjectMeta } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { Docs } from "../docs";
import type { ProjectHostRegistry } from "./types";

export function createProjectHosts(docs: Docs, user: string): ProjectHostRegistry {
  const access = new Map<string, ProjectAccess>();
  const locked = new Set<string>();
  const listeners = new Set<(projectId: string) => void>();
  const watching = new Map<string, () => void>();
  const watch = (projectId: string, doc: LoroDoc) => {
    watching.get(projectId)?.();
    watching.set(
      projectId,
      doc.subscribeLocalUpdates(() => {
        for (const listener of listeners) listener(projectId);
      }),
    );
  };
  for (const id of docs.projectIds()) watch(id, docs.project(id));
  docs.onProjectDoc(watch);
  docs.setWriteGuard((projectId) => {
    if (locked.has(projectId)) throw new KiboError("CONFLICT", `project ${projectId} is being shared`);
    const current = access.get(projectId) ?? "write";
    if (current !== "write") throw new KiboError("FORBIDDEN", `project ${projectId} is ${current}`);
  });
  return {
    host: (projectId) => ({
      doc: () => docs.project(projectId),
      applyRemote: (bytes) => {
        docs.project(projectId).import(bytes);
        docs.imported(projectId);
      },
      replaceDoc: (doc) => docs.replaceProject(projectId, doc),
    }),
    projectIds: () => docs.projectIds(),
    setAccess: (projectId, next) => {
      if ((access.get(projectId) ?? "write") === next) return;
      access.set(projectId, next);
      docs.emit({ projectId });
    },
    setLocked: (projectId, isLocked) => {
      if (isLocked) locked.add(projectId);
      else locked.delete(projectId);
    },
    onLocalChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mutate: (projectId, fn) => {
      docs.assertWritable(projectId);
      const doc = docs.project(projectId);
      fn(doc);
      doc.commit();
      docs.imported(projectId);
    },
    addJoinedProject: (doc, folder): ProjectMeta => {
      const meta = { ...getProjectMeta(doc), folder };
      docs.addProject(meta, doc);
      return meta;
    },
    localUser: () => user,
  };
}
