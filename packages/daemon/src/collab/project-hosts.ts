import { depthViolation, getProjectMeta, projectDepthViolation } from "@kibo/core";
import { KiboError, type ProjectAccess, type ProjectMeta } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import type { Docs } from "../docs";
import { assertCompleteHistory, assertSharedShape, importComplete, refuseTooDeep } from "./sync-blob";
import type { ProjectHostRegistry } from "./types";

function withoutPending(projectId: string, doc: LoroDoc): LoroDoc {
  assertCompleteHistory(projectId, doc);
  refuseTooDeep(projectId, projectDepthViolation(doc));
  return LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
}

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
  docs.onProjectRemoved((projectId) => {
    watching.get(projectId)?.();
    watching.delete(projectId);
    access.delete(projectId);
    locked.delete(projectId);
  });
  docs.setWriteGuard((projectId) => {
    if (locked.has(projectId)) throw new KiboError("CONFLICT", `project ${projectId} is being shared`);
    const current = access.get(projectId) ?? "write";
    if (current !== "write") throw new KiboError("FORBIDDEN", `project ${projectId} is ${current}`);
  });
  return {
    host: (projectId) => ({
      doc: () => docs.project(projectId),
      applyRemote: (bytes) => {
        const doc = docs.project(projectId);
        const candidate = doc.fork();
        importComplete(projectId, candidate, bytes);
        assertSharedShape(projectId, candidate);
        refuseTooDeep(projectId, depthViolation(doc, candidate));
        doc.import(bytes);
        docs.imported(projectId);
      },
      replaceDoc: (doc) => {
        const adopted = withoutPending(projectId, doc);
        assertSharedShape(projectId, adopted);
        docs.replaceProject(projectId, adopted);
      },
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
    assertWritable: (projectId) => docs.assertWritable(projectId),
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
    addJoinedProject: (joined, folder): ProjectMeta => {
      const doc = withoutPending(getProjectMeta(joined).id, joined);
      const meta = { ...getProjectMeta(doc), folder };
      docs.addProject(meta, doc);
      return meta;
    },
    localUser: () => user,
  };
}
