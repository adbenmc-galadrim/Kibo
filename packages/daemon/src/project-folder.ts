import { type ProjectMeta, STORYBOOK_DEFAULTS, StorybookSettings, WorktreeSettings } from "@kibo/schema";
import type { z } from "zod";
import type { ProjectSettings } from "./notes/settings";

export const LOCAL_FOLDER_KEY = "folder";
export const LOCAL_WORKTREE_KEY = "worktree";
export const LOCAL_STORYBOOK_KEY = "storybook";

type Reader = Pick<ProjectSettings, "get">;

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function localJson<T>(settings: Reader, projectId: string, key: string, schema: z.ZodType<T>): T | null {
  const raw = settings.get(projectId, key);
  if (raw === null) return null;
  const parsed = schema.safeParse(safeJson(raw));
  if (parsed.success) return parsed.data;
  console.error(`[kibo-daemon] ignoring invalid ${key} settings of project ${projectId}`);
  return null;
}

export const localWorktree = (settings: Reader, projectId: string): WorktreeSettings | null =>
  localJson(settings, projectId, LOCAL_WORKTREE_KEY, WorktreeSettings);

export const localStorybook = (settings: Reader, projectId: string): StorybookSettings | null =>
  localJson(settings, projectId, LOCAL_STORYBOOK_KEY, StorybookSettings);

export const storybookSettingsOf = (settings: Reader, projectId: string): StorybookSettings =>
  localStorybook(settings, projectId) ?? STORYBOOK_DEFAULTS;

export function withLocalSettings(
  meta: ProjectMeta,
  settings: ProjectSettings,
  shared: boolean,
): ProjectMeta {
  const folder = settings.get(meta.id, LOCAL_FOLDER_KEY);
  const worktree = localWorktree(settings, meta.id);
  const storybook = localStorybook(settings, meta.id);
  if (shared) return { ...meta, folder, worktree, storybook };
  return { ...meta, folder: folder ?? meta.folder, worktree, storybook };
}
