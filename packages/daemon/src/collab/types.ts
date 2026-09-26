import type { ProjectAccess, ProjectMeta } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { SyncHost } from "./project-sync";

export type { SyncHost } from "./project-sync";

export type ProjectHostRegistry = {
  host(projectId: string): SyncHost;
  projectIds(): string[];
  setAccess(projectId: string, access: ProjectAccess): void;
  setLocked(projectId: string, locked: boolean): void;
  onLocalChange(listener: (projectId: string) => void): () => void;
  addJoinedProject(doc: LoroDoc, folder: string | null): ProjectMeta;
  localUser(): string;
  mutate(projectId: string, fn: (doc: LoroDoc) => void): void;
};
