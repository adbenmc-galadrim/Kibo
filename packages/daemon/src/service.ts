import {
  countTicketsByStatus,
  createProjectDoc,
  createWorkspaceDoc,
  executeProjectCommand,
  listProjects,
  readProject,
  registerProject,
} from "@kibo/core";
import { KiboError, type ProjectMeta, type RpcRequest } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { loadDoc, type Store } from "./store";

export type Service = {
  handle(req: RpcRequest): unknown;
  onChange(listener: (projectId: string | null) => void): () => void;
};

const WORKSPACE = "workspace";
const projectDocId = (id: string) => `project:${id}`;

export function createService(store: Store, opts: { user: string }): Service {
  const workspace = loadDoc(store, WORKSPACE) ?? createWorkspaceDoc();
  const projects = new Map<string, LoroDoc>();
  for (const meta of listProjects(workspace)) {
    const doc = loadDoc(store, projectDocId(meta.id));
    if (!doc) throw new KiboError("STORE_CORRUPT", `project ${meta.key} is registered but has no data`);
    projects.set(meta.id, doc);
  }
  const listeners = new Set<(projectId: string | null) => void>();
  const emit = (id: string | null) => {
    for (const l of listeners) l(id);
  };
  const persist = (id: string, doc: LoroDoc) => store.save(id, doc.export({ mode: "snapshot" }));
  const project = (id: string): LoroDoc => {
    const doc = projects.get(id);
    if (!doc) throw new KiboError("NOT_FOUND", `project ${id} not found`);
    return doc;
  };

  return {
    handle(req) {
      switch (req.method) {
        case "getSession":
          return { user: opts.user };
        case "listProjects":
          return listProjects(workspace).map((meta) => ({
            ...meta,
            counts: countTicketsByStatus(project(meta.id)),
          }));
        case "createProject": {
          const meta: ProjectMeta = {
            id: crypto.randomUUID(),
            key: req.key,
            name: req.name,
            folder: req.folder,
            color: req.color,
          };
          registerProject(workspace, meta);
          const doc = createProjectDoc(meta);
          persist(projectDocId(meta.id), doc);
          persist(WORKSPACE, workspace);
          projects.set(meta.id, doc);
          emit(null);
          return meta;
        }
        case "getProject":
          return readProject(project(req.projectId));
        case "command": {
          const doc = project(req.projectId);
          const result = executeProjectCommand(doc, req.command);
          persist(projectDocId(req.projectId), doc);
          emit(req.projectId);
          return result;
        }
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
