import type { ChangeMessage } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

export type Docs = {
  workspace: LoroDoc;
  project(id: string): LoroDoc;
  projectIds(): string[];
  save(projectId: string | null): void;
  emit(message: ChangeMessage): void;
};
