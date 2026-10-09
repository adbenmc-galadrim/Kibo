import { type ProjectMeta, WorktreeSettings } from "@kibo/schema";
import type { ProjectSettings } from "./notes/settings";

export const LOCAL_FOLDER_KEY = "folder";
export const LOCAL_WORKTREE_KEY = "worktree";

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function localWorktree(
  settings: Pick<ProjectSettings, "get">,
  projectId: string,
): WorktreeSettings | null {
  const raw = settings.get(projectId, LOCAL_WORKTREE_KEY);
  if (raw === null) return null;
  const parsed = WorktreeSettings.safeParse(safeJson(raw));
  if (parsed.success) return parsed.data;
  console.error(`[kibo-daemon] ignoring invalid worktree settings of project ${projectId}`);
  return null;
}

export function withLocalSettings(
  meta: ProjectMeta,
  settings: ProjectSettings,
  shared: boolean,
): ProjectMeta {
  const folder = settings.get(meta.id, LOCAL_FOLDER_KEY);
  const worktree = localWorktree(settings, meta.id);
  if (shared) return { ...meta, folder, worktree };
  return { ...meta, folder: folder ?? meta.folder, worktree };
}
