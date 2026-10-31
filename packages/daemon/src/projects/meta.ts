import { setProjectMeta, updateRegisteredProject } from "@kibo/core";
import type { ProjectMeta, ProjectPatch } from "@kibo/schema";
import type { Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";
import { LOCAL_DELIVERY_KEY, LOCAL_STORYBOOK_KEY, LOCAL_WORKTREE_KEY } from "../project-folder";

type SharedPatch = Omit<ProjectPatch, "worktree" | "storybook" | "delivery">;

const sharedFields = (patch: ProjectPatch): SharedPatch => ({
  ...(patch.name !== undefined && { name: patch.name }),
  ...(patch.color !== undefined && { color: patch.color }),
  ...(patch.tracking !== undefined && { tracking: patch.tracking }),
  ...(patch.description !== undefined && { description: patch.description }),
  ...(patch.client !== undefined && { client: patch.client }),
  ...(patch.folder !== undefined && { folder: patch.folder }),
});

const registryFields = ({
  tracking: _tracking,
  description: _description,
  client: _client,
  ...fields
}: SharedPatch): SharedPatch => fields;

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

function writeLocalDelivery(settings: ProjectSettings, projectId: string, patch: ProjectPatch): void {
  if (patch.delivery === undefined) return;
  if (patch.delivery === null) settings.unset(projectId, LOCAL_DELIVERY_KEY);
  else settings.set(projectId, LOCAL_DELIVERY_KEY, JSON.stringify(patch.delivery));
}

function writeSharedFields(docs: Docs, projectId: string, patch: SharedPatch): void {
  if (Object.keys(patch).length === 0) return;
  setProjectMeta(docs.project(projectId), patch);
  const registered = registryFields(patch);
  if (Object.keys(registered).length > 0) updateRegisteredProject(docs.workspace, projectId, registered);
  docs.save(projectId);
  docs.save(null);
}

export function writeProjectMeta(
  docs: Docs,
  settings: ProjectSettings,
  projectId: string,
  patch: ProjectPatch,
): ProjectMeta {
  writeLocalWorktree(settings, projectId, patch);
  writeLocalStorybook(settings, projectId, patch);
  writeLocalDelivery(settings, projectId, patch);
  writeSharedFields(docs, projectId, sharedFields(patch));
  docs.emit({ projectId });
  docs.emit({ projectId: null });
  return docs.projectMeta(projectId);
}
