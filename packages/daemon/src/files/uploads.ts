import { constants } from "node:fs";
import { link, mkdir, open, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  extensionMatches,
  KiboError,
  MAX_PROJECT_ASSET_BYTES,
  MAX_PROJECT_ASSETS_BYTES,
  MAX_UPLOADS_PER_PROJECT,
  type ProjectAsset,
  type ProjectAssetMime,
  ProjectAssetName,
  UPLOAD_CHUNK_BYTES,
  UPLOAD_IDLE_MS,
} from "@kibo/schema";
import { lstatOrNull } from "../fs/resolve-inside";
import { assetOf, folderUsage, resolveAsset, sniffFile } from "./files-fs";

export type Uploads = {
  begin(projectId: string, name: string, mime: ProjectAssetMime, size: number): Promise<{ uploadId: string }>;
  append(uploadId: string, index: number, bytes: Uint8Array): Promise<{ received: number }>;
  finish(uploadId: string): Promise<ProjectAsset>;
  cancel(uploadId: string): Promise<void>;
  close(): Promise<void>;
};
export type UploadsOptions = {
  dir(projectId: string): string;
  now?: () => number;
  maxProjectBytes?: number;
};

type Upload = {
  id: string;
  projectId: string;
  dir: string;
  name: string;
  mime: ProjectAssetMime;
  size: number;
  received: number;
  path: string | null;
  touchedAt: number;
  busy: boolean;
  cancelled: boolean;
};

const UPLOADS = ".uploads";
const APPEND_FLAGS = constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW;
const invalid = (detail: string) => new KiboError("INVALID_INPUT", detail);
const errnoOf = (e: unknown) => (e instanceof Error && "code" in e ? e.code : null);

async function appendBytes(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await open(path, APPEND_FLAGS);
  try {
    let written = 0;
    while (written < bytes.byteLength) {
      const { bytesWritten } = await handle.write(bytes, written, bytes.byteLength - written);
      written += bytesWritten;
    }
  } finally {
    await handle.close();
  }
}

async function linkExclusive(from: string, to: string, name: string): Promise<void> {
  try {
    await link(from, to);
  } catch (e) {
    if (errnoOf(e) === "EEXIST") throw new KiboError("CONFLICT", `project file ${name} already exists`);
    if (errnoOf(e) === "EPERM" || errnoOf(e) === "ENOTSUP")
      throw new KiboError("INTERNAL", `the files folder does not support hard links: ${String(e)}`);
    throw e;
  }
}

export function createUploads(opts: UploadsOptions): Uploads {
  const now = opts.now ?? Date.now;
  const maxProjectBytes = opts.maxProjectBytes ?? MAX_PROJECT_ASSETS_BYTES;
  const live = new Map<string, Upload>();

  const discard = async (u: Upload) => {
    live.delete(u.id);
    if (u.path) await rm(u.path, { force: true });
  };
  const sweep = async () => {
    const idle = [...live.values()].filter((u) => !u.busy && now() - u.touchedAt > UPLOAD_IDLE_MS);
    for (const u of idle) await discard(u);
  };
  const purgeOrphans = async (folder: string) => {
    for (const name of await readdir(folder)) {
      if (live.has(name)) continue;
      const path = join(folder, name);
      const info = await lstatOrNull(path);
      if (info !== null && now() - info.mtimeMs > UPLOAD_IDLE_MS)
        await rm(path, { force: true, recursive: true });
    }
  };
  const createTemp = async (dir: string, id: string): Promise<string> => {
    const folder = await resolveAsset(dir, UPLOADS);
    try {
      await mkdir(folder, { mode: 0o700 });
    } catch (e) {
      if (errnoOf(e) !== "EEXIST") throw e;
    }
    const path = await resolveAsset(dir, `${UPLOADS}/${id}`);
    await purgeOrphans(folder);
    const handle = await open(path, "wx", 0o600);
    await handle.close();
    return path;
  };
  const pendingBytes = (dir: string, except: string) =>
    [...live.values()].filter((u) => u.dir === dir && u.id !== except).reduce((sum, u) => sum + u.size, 0);
  const take = (uploadId: string): Upload => {
    const u = live.get(uploadId);
    if (!u) throw new KiboError("NOT_FOUND", `upload ${uploadId} not found`);
    if (u.busy) throw invalid(`upload ${uploadId} is busy`);
    return u;
  };
  const checkRequest = (name: string, mime: ProjectAssetMime, size: number) => {
    if (!ProjectAssetName.safeParse(name).success) throw invalid(`invalid project file name ${name}`);
    if (!extensionMatches(name, mime)) throw invalid(`${name} does not match ${mime}`);
    if (!Number.isSafeInteger(size) || size <= 0) throw invalid(`invalid size ${size}`);
    if (size > MAX_PROJECT_ASSET_BYTES)
      throw new KiboError("TOO_LARGE", `${name} exceeds ${MAX_PROJECT_ASSET_BYTES} bytes`);
  };
  const prepare = async (u: Upload) => {
    await mkdir(u.dir, { recursive: true, mode: 0o700 });
    if ((await folderUsage(u.dir)) + pendingBytes(u.dir, u.id) + u.size > maxProjectBytes)
      throw new KiboError("QUOTA_EXCEEDED", `the files folder would exceed ${maxProjectBytes} bytes`);
    if ((await lstatOrNull(await resolveAsset(u.dir, u.name))) !== null)
      throw new KiboError("CONFLICT", `project file ${u.name} already exists`);
    u.path = await createTemp(u.dir, u.id);
  };
  const complete = async (u: Upload): Promise<ProjectAsset> => {
    if (u.received !== u.size || !u.path)
      throw invalid(`upload ${u.id} received ${u.received} of ${u.size} bytes`);
    if (u.cancelled) throw new KiboError("NOT_FOUND", `upload ${u.id} was cancelled`);
    const file = await sniffFile(u.path, `${UPLOADS}/${u.id}`);
    if (!file || file.size !== u.size || file.mime !== u.mime) throw invalid(`${u.name} is not a ${u.mime}`);
    await linkExclusive(u.path, await resolveAsset(u.dir, u.name), u.name);
    return assetOf(u.name, u.mime, file);
  };

  return {
    async begin(projectId, name, mime, size) {
      checkRequest(name, mime, size);
      await sweep();
      const alive = [...live.values()].filter((u) => u.projectId === projectId).length;
      if (alive >= MAX_UPLOADS_PER_PROJECT)
        throw new KiboError("RATE_LIMITED", `at most ${MAX_UPLOADS_PER_PROJECT} uploads per project`);
      const id = crypto.randomUUID();
      const u: Upload = {
        id,
        projectId,
        dir: opts.dir(projectId),
        name,
        mime,
        size,
        received: 0,
        path: null,
        touchedAt: now(),
        busy: true,
        cancelled: false,
      };
      live.set(id, u);
      try {
        await prepare(u);
      } catch (e) {
        await discard(u);
        throw e;
      }
      u.busy = false;
      return { uploadId: id };
    },
    async append(uploadId, index, bytes) {
      const u = take(uploadId);
      const length = bytes.byteLength;
      const last = u.received + length === u.size;
      if (index !== Math.floor(u.received / UPLOAD_CHUNK_BYTES))
        throw invalid(`chunk ${index} is not expected`);
      if (
        length === 0 ||
        length > UPLOAD_CHUNK_BYTES ||
        u.received + length > u.size ||
        (length !== UPLOAD_CHUNK_BYTES && !last)
      )
        throw invalid(`chunk ${index} has a wrong size`);
      if (!u.path) throw invalid(`upload ${uploadId} is not ready`);
      u.busy = true;
      try {
        await appendBytes(u.path, bytes);
      } catch (e) {
        await discard(u);
        throw e;
      }
      if (u.cancelled) {
        await discard(u);
        throw new KiboError("NOT_FOUND", `upload ${uploadId} was cancelled`);
      }
      u.received += length;
      u.touchedAt = now();
      u.busy = false;
      return { received: u.received };
    },
    async finish(uploadId) {
      const u = take(uploadId);
      u.busy = true;
      try {
        return await complete(u);
      } finally {
        await discard(u);
      }
    },
    async cancel(uploadId) {
      const u = live.get(uploadId);
      if (!u) return;
      if (u.busy) u.cancelled = true;
      else await discard(u);
    },
    async close() {
      for (const u of [...live.values()]) await discard(u);
    },
  };
}
