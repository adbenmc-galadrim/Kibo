import type { Database } from "bun:sqlite";
import { mkdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
  type AssetUrl,
  type FilesInfo,
  KiboError,
  type ProjectAsset,
  type ProjectAssetMime,
} from "@kibo/schema";
import { isInside } from "../code/safe-path";
import { assertNotInbox } from "../inbox/inbox-rules";
import { createProjectSettings } from "../notes/settings";
import {
  describeAssetFile,
  folderUsage,
  listAssetFiles,
  notFound,
  openAssetFile,
  removeAssetFile,
} from "./files-fs";
import { createFileTokens } from "./tokens";
import { createUploads, type Uploads } from "./uploads";

export type OpenedFile = { path: string; mime: ProjectAssetMime; size: number };
export type FilesService = {
  dirOf(projectId: string): string;
  info(projectId: string): Promise<FilesInfo>;
  setDir(projectId: string, dir: string | null): Promise<FilesInfo>;
  list(projectId: string): Promise<ProjectAsset[]>;
  remove(projectId: string, name: string): Promise<void>;
  uploads: Uploads;
  url(projectId: string, instanceId: string, name: string): Promise<AssetUrl>;
  open(token: string): Promise<OpenedFile | null>;
  close(): Promise<void>;
};
export type FilesServiceDeps = {
  db: Database;
  home: string;
  project(id: string): { id: string; key: string; folder: string | null };
  sandboxOrigin(): string | null;
  now?: () => number;
  homeDir?: string;
};

const FILES_DIR = "filesDir";
const isGone = (e: unknown) =>
  e instanceof KiboError && (e.code === "NOT_FOUND" || e.code === "PATH_OUTSIDE_PROJECT");

export function createFilesService(deps: FilesServiceDeps): FilesService {
  const settings = createProjectSettings(deps.db);
  const homeDir = deps.homeDir ?? homedir();
  const dirOf = (projectId: string) => {
    assertNotInbox(projectId, "project files");
    const { key } = deps.project(projectId);
    return settings.get(projectId, FILES_DIR) ?? join(deps.home, "files", key);
  };
  const uploads = createUploads({ dir: dirOf, ...(deps.now && { now: deps.now }) });
  const tokens = createFileTokens({ ...(deps.now && { now: deps.now }) });

  const info = async (projectId: string): Promise<FilesInfo> => {
    const dir = dirOf(projectId);
    const displayDir = isInside(homeDir, dir) ? `~${dir.slice(homeDir.length)}` : dir;
    return { dir, displayDir, used: await folderUsage(dir) };
  };
  const setDir = async (projectId: string, dir: string | null): Promise<FilesInfo> => {
    dirOf(projectId);
    if (dir === null) {
      settings.unset(projectId, FILES_DIR);
      return info(projectId);
    }
    if (!isAbsolute(dir) || dir.includes("\0"))
      throw new KiboError("INVALID_INPUT", "the files folder must be an absolute path");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    settings.set(projectId, FILES_DIR, await realpath(dir));
    return info(projectId);
  };
  const url = async (projectId: string, instanceId: string, name: string): Promise<AssetUrl> => {
    const asset = await describeAssetFile(dirOf(projectId), name);
    if (!asset) throw notFound(name);
    const origin = deps.sandboxOrigin();
    if (!origin) throw new KiboError("INTERNAL", "sandbox listener not started");
    const minted = tokens.mint(instanceId, { projectId, name, mime: asset.mime });
    return { url: `${origin}/f/${minted.token}/${name}`, expiresAt: minted.expiresAt };
  };
  const open = async (token: string): Promise<OpenedFile | null> => {
    const grant = tokens.lookup(token);
    if (!grant) return null;
    try {
      const file = await openAssetFile(dirOf(grant.projectId), grant.name, grant.mime);
      return { path: file.path, mime: grant.mime, size: file.size };
    } catch (e) {
      if (isGone(e)) return null;
      throw e;
    }
  };

  return {
    dirOf,
    info,
    setDir,
    list: (projectId) => listAssetFiles(dirOf(projectId)),
    remove: (projectId, name) => removeAssetFile(dirOf(projectId), name),
    uploads,
    url,
    open,
    close: () => uploads.close(),
  };
}
