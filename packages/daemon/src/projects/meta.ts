import { setProjectMeta, updateRegisteredProject } from "@kibo/core";
import type { ProjectMeta, ProjectPatch } from "@kibo/schema";
import type { Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";
import {
  LOCAL_DELIVERY_KEY,
  LOCAL_DUPLICATION_KEY,
  LOCAL_STORYBOOK_KEY,
  LOCAL_WORKTREE_KEY,
} from "../project-folder";

type SharedPatch = Omit<ProjectPatch, "worktree" | "storybook" | "duplication" | "delivery">;

const docFields = (patch: SharedPatch): SharedPatch => ({
  ...(patch.name !== undefined && { name: patch.name }),
  ...(patch.color !== undefined && { color: patch.color }),
});

const sharedFields = (patch: ProjectPatch): SharedPatch => ({
  ...docFields(patch),
  ...(patch.folder !== undefined && { folder: patch.folder }),
});

function writeLocalWorktree(settings: ProjectSettings, projectId: string, patch: ProjectPatch): void {
  if (patch.worktree === undefined) return;
  if (patch.worktree === null) settings.unset(projectId, LOCAL_WORKTREE_KEY);
  else settings.set(projectId, LOCAL_WORKTREE_KEY, JSON.stringify(patch.worktree));
}

function writeLocalStorybook(settings: ProjectSettings, projectId: string, patch: ProjectPatch): void {
  if (patch.storybook === undefined) return;
  if (patch.storybook === null) settings.unset(projectId, LOCAL_STORYBOOK_KEY);
  else settings.set(projectId, LOCAL_STORYBOOK_KEY, JSON.stringify(patch.storybook));
}

function writeLocalDuplication(settings: ProjectSettings, projectId: string, patch: ProjectPatch): void {
  if (patch.duplication === undefined) return;
  if (patch.duplication === null) settings.unset(projectId, LOCAL_DUPLICATION_KEY);
  else settings.set(projectId, LOCAL_DUPLICATION_KEY, JSON.stringify(patch.duplication));
}

function writeLocalDelivery(settings: ProjectSettings, projectId: string, patch: ProjectPatch): void {
  if (patch.delivery === undefined) return;
  if (patch.delivery === null) settings.unset(projectId, LOCAL_DELIVERY_KEY);
  else settings.set(projectId, LOCAL_DELIVERY_KEY, JSON.stringify(patch.delivery));
}

function writeSharedFields(docs: Docs, projectId: string, patch: SharedPatch, folderInDoc: boolean): void {
  if (Object.keys(patch).length === 0) return;
  const docPatch = folderInDoc ? patch : docFields(patch);
  if (Object.keys(docPatch).length > 0) setProjectMeta(docs.project(projectId), docPatch);
  updateRegisteredProject(docs.workspace, projectId, patch);
  docs.save(projectId);
  docs.save(null);
}

export function writeProjectMeta(
  docs: Docs,
  settings: ProjectSettings,
  projectId: string,
  patch: ProjectPatch,
  folderInDoc: boolean,
): ProjectMeta {
  writeLocalWorktree(settings, projectId, patch);
  writeLocalStorybook(settings, projectId, patch);
  writeLocalDuplication(settings, projectId, patch);
  writeLocalDelivery(settings, projectId, patch);
  writeSharedFields(docs, projectId, sharedFields(patch), folderInDoc);
  docs.emit({ projectId });
  docs.emit({ projectId: null });
  return docs.projectMeta(projectId);
}
