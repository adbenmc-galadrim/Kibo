import type { ProjectMeta } from "@kibo/schema";
import type { ProjectSettings } from "./notes/settings";

export const LOCAL_FOLDER_KEY = "folder";

export function withLocalFolder(meta: ProjectMeta, settings: ProjectSettings, shared: boolean): ProjectMeta {
  const folder = settings.get(meta.id, LOCAL_FOLDER_KEY);
  if (shared) return { ...meta, folder };
  return folder === null ? meta : { ...meta, folder };
}
