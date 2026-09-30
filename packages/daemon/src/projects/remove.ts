import { unregisterProject } from "@kibo/core";
import type { ChangeMessage } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { Store } from "../store";
import { projectDocId, WORKSPACE_DOC_ID } from "./doc-ids";

export type ProjectRemovalDeps = {
  store: Pick<Store, "transaction" | "delete" | "save">;
  workspace: LoroDoc;
  drop(projectId: string): void;
  emit(message: ChangeMessage): void;
};
export type ProjectRemoval = {
  remove(projectId: string): void;
  onRemoved(listener: (projectId: string) => void): () => void;
};

export function createProjectRemoval(deps: ProjectRemovalDeps): ProjectRemoval {
  const listeners = new Set<(projectId: string) => void>();
  const persist = (projectId: string) => {
    const next = deps.workspace.fork();
    unregisterProject(next, projectId);
    const update = next.export({ mode: "update", from: deps.workspace.oplogVersion() });
    deps.store.transaction(() => {
      deps.store.delete(projectDocId(projectId));
      deps.store.save(WORKSPACE_DOC_ID, next.export({ mode: "snapshot" }));
    });
    deps.workspace.import(update);
  };
  return {
    remove(projectId) {
      persist(projectId);
      deps.drop(projectId);
      for (const listener of listeners) listener(projectId);
      deps.emit({ projectId: null });
    },
    onRemoved(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
