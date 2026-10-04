import { constants } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { MAX_PROJECT_ASSET_BYTES, type ProjectAssetMime, sniffAsset } from "@kibo/schema";

export type ServedFile = { path: string; name: string; mime: ProjectAssetMime; size: number };
export type FileOpener = { open(token: string): Promise<ServedFile | null> };

const READ_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const HEAD_BYTES = 16;

export function fileHeaders(mime: ProjectAssetMime, size: number): Record<string, string> {
  return {
    "content-type": mime,
    "content-length": String(size),
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-site",
    "access-control-allow-origin": "*",
    "cache-control": "private, max-age=900",
    "content-security-policy": "default-src 'none'; sandbox",
    "referrer-policy": "no-referrer",
    "accept-ranges": "none",
  };
}

async function sizeIfMatching(handle: FileHandle, mime: ProjectAssetMime): Promise<number | null> {
  const info = await handle.stat();
  if (!info.isFile() || info.size > MAX_PROJECT_ASSET_BYTES) return null;
  const head = new Uint8Array(HEAD_BYTES);
  const { bytesRead } = await handle.read(head, 0, HEAD_BYTES, 0);
  return sniffAsset(head.subarray(0, bytesRead)) === mime ? info.size : null;
}

async function readUpTo(handle: FileHandle, size: number): Promise<Uint8Array> {
  const body = new Uint8Array(size);
  let position = 0;
  while (position < size) {
    const { bytesRead } = await handle.read(body, position, size - position, position);
    if (bytesRead === 0) break;
    position += bytesRead;
  }
  return body.subarray(0, position);
}

export async function fileResponse(file: ServedFile, method: "GET" | "HEAD"): Promise<Response | null> {
  const handle = await open(file.path, READ_FLAGS);
  try {
    const size = await sizeIfMatching(handle, file.mime);
    if (size === null) return null;
    if (method === "HEAD") return new Response(null, { headers: fileHeaders(file.mime, size) });
    const body = await readUpTo(handle, size);
    return new Response(body, { headers: fileHeaders(file.mime, body.byteLength) });
  } finally {
    await handle.close();
  }
}
