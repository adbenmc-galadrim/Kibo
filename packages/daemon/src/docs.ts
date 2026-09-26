import type { RuleTrigger } from "@kibo/core/rules";
import type { ChangeMessage, ProjectCommand } from "@kibo/schema";
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
  trigger(projectId: string, trigger: RuleTrigger, meta?: CommandMeta): number;
};
