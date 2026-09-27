import type { ProjectMeta } from "@kibo/schema";
import type { ProjectSettings } from "./notes/settings";

export const LOCAL_FOLDER_KEY = "folder";

export function withLocalFolder(meta: ProjectMeta, settings: ProjectSettings): ProjectMeta {
  const folder = settings.get(meta.id, LOCAL_FOLDER_KEY);
  return folder === null ? meta : { ...meta, folder };
}
