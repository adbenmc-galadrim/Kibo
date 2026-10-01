import type { RuleTrigger } from "@kibo/core/rules";
import type { ChangeMessage, ProjectCommand, ProjectMeta, ProjectPatch } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

export type CommandOrigin = "user" | "sync";
export type CommandMeta = { origin: CommandOrigin; instanceId: string | null };
export type CommandEvent = { projectId: string; command: ProjectCommand; result: unknown; meta: CommandMeta };
export type CommandInterceptor = (
  projectId: string,
  cmd: ProjectCommand,
  meta: CommandMeta,
) => ProjectCommand;
export const USER_COMMAND: CommandMeta = { origin: "user", instanceId: null };

export type Docs = {
  workspace: LoroDoc;
  project(id: string): LoroDoc;
  projectIds(): string[];
  save(projectId: string | null): void;
  emit(message: ChangeMessage): void;
  run(projectId: string, command: ProjectCommand, meta?: CommandMeta): unknown;
  trigger(projectId: string, trigger: RuleTrigger): number;
  replaceProject(projectId: string, doc: LoroDoc): void;
  addProject(meta: ProjectMeta, doc: LoroDoc): void;
  removeProject(projectId: string): void;
  onProjectRemoved(listener: (projectId: string) => void): () => void;
  imported(projectId: string): void;
  onProjectDoc(listener: (projectId: string, doc: LoroDoc) => void): () => void;
  assertWritable(projectId: string): void;
  setWriteGuard(guard: (projectId: string) => void): () => void;
  projectMeta(projectId: string): ProjectMeta;
  updateProjectMeta(projectId: string, patch: ProjectPatch, folderInDoc: boolean): ProjectMeta;
  identity(projectId: string): string;
  setIdentity(fn: (projectId: string) => string): () => void;
};
