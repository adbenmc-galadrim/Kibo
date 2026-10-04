import { constants } from "node:fs";
import { open, readdir, unlink } from "node:fs/promises";
import {
  assetKindOf,
  extensionMatches,
  KiboError,
  type ProjectAsset,
  type ProjectAssetMime,
  ProjectAssetName,
  sniffAsset,
} from "@kibo/schema";
import { outside, resolveInside } from "../fs/resolve-inside";

const HEAD = 16;
const LABEL = "project file";
const READ_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

export type SniffedFile = { mime: ProjectAssetMime | null; size: number; mtime: number };

const errnoOf = (e: unknown) => (e instanceof Error && "code" in e ? e.code : null);
export const notFound = (name: string) => new KiboError("NOT_FOUND", `project file ${name} not found`);
const UNREADABLE = new Set(["ENOENT", "EACCES", "EPERM", "ENXIO"]);

export async function resolveAsset(dir: string, name: string): Promise<string> {
  try {
    return await resolveInside(dir, name, LABEL);
  } catch (e) {
    if (errnoOf(e) === "ENOENT") throw notFound(name);
    throw e;
  }
}

export async function sniffFile(path: string, rel: string): Promise<SniffedFile | null> {
  let file: Awaited<ReturnType<typeof open>>;
  try {
    file = await open(path, READ_FLAGS);
  } catch (e) {
    if (UNREADABLE.has(String(errnoOf(e)))) return null;
    if (errnoOf(e) === "ELOOP") throw outside(rel, LABEL);
    throw e;
  }
  try {
    const info = await file.stat();
    if (!info.isFile()) return null;
    const head = new Uint8Array(HEAD);
    const { bytesRead } = await file.read(head, 0, HEAD, 0);
    return { mime: sniffAsset(head.subarray(0, bytesRead)), size: info.size, mtime: info.mtimeMs };
  } finally {
    await file.close();
  }
}

export const assetOf = (name: string, mime: ProjectAssetMime, file: SniffedFile): ProjectAsset => ({
  name,
  mime,
  kind: assetKindOf(mime),
  size: file.size,
  mtime: file.mtime,
});

export async function describeAssetFile(dir: string, name: string): Promise<ProjectAsset | null> {
  if (!ProjectAssetName.safeParse(name).success) return null;
  const file = await sniffFile(await resolveAsset(dir, name), name);
  if (!file || file.mime === null || !extensionMatches(name, file.mime)) return null;
  return assetOf(name, file.mime, file);
}

async function namesIn(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (e) {
    if (errnoOf(e) === "ENOENT") return [];
    throw e;
  }
}

const skipOutside = (e: unknown): null => {
  if (e instanceof KiboError && e.code === "PATH_OUTSIDE_PROJECT") return null;
  throw e;
};

export async function listAssetFiles(dir: string): Promise<ProjectAsset[]> {
  const out: ProjectAsset[] = [];
  for (const name of (await namesIn(dir)).sort()) {
    const asset = await describeAssetFile(dir, name).catch(skipOutside);
    if (asset) out.push(asset);
  }
  return out;
}

export async function openAssetFile(
  dir: string,
  name: string,
  mime: ProjectAssetMime,
): Promise<{ path: string; size: number }> {
  const asset = await describeAssetFile(dir, name);
  if (!asset || asset.mime !== mime) throw notFound(name);
  return { path: await resolveAsset(dir, name), size: asset.size };
}

export async function removeAssetFile(dir: string, name: string): Promise<void> {
  const asset = await describeAssetFile(dir, name);
  if (!asset) throw notFound(name);
  await unlink(await resolveAsset(dir, name));
}

export const folderUsage = async (dir: string): Promise<number> =>
  (await listAssetFiles(dir)).reduce((sum, a) => sum + a.size, 0);
