import { z } from "zod";
import { sniffImage } from "./note";

export const PROJECT_ASSET_KINDS = ["model", "image", "audio"] as const;
export const ProjectAssetKind = z.enum(PROJECT_ASSET_KINDS);
export type ProjectAssetKind = z.infer<typeof ProjectAssetKind>;

export const PROJECT_ASSET_MIMES = [
  "model/gltf-binary",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
] as const;
export const ProjectAssetMime = z.enum(PROJECT_ASSET_MIMES);
export type ProjectAssetMime = z.infer<typeof ProjectAssetMime>;

export const ProjectAssetName = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{0,120}\.(glb|png|jpe?g|webp|gif|mp3|ogg|wav)$/);
export type ProjectAssetName = z.infer<typeof ProjectAssetName>;

export const MAX_PROJECT_ASSET_BYTES = 64 * 1024 * 1024;
export const MAX_PROJECT_ASSETS_BYTES = 512 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 1_048_576;
export const MAX_UPLOAD_CHUNK_BASE64 = 1_400_000;
export const ASSET_URL_TTL_MS = 15 * 60_000;
export const MAX_UPLOADS_PER_PROJECT = 4;
export const UPLOAD_IDLE_MS = 10 * 60_000;

export const ProjectAsset = z.object({
  name: ProjectAssetName,
  mime: ProjectAssetMime,
  kind: ProjectAssetKind,
  size: z.number().int().nonnegative(),
  mtime: z.number(),
});
export type ProjectAsset = z.infer<typeof ProjectAsset>;
export const AssetUrl = z.object({ url: z.string().url(), expiresAt: z.number() });
export type AssetUrl = z.infer<typeof AssetUrl>;
export const FilesInfo = z.object({
  dir: z.string(),
  displayDir: z.string(),
  used: z.number().int().nonnegative(),
});
export type FilesInfo = z.infer<typeof FilesInfo>;

const EXTENSIONS: Readonly<Record<ProjectAssetMime, readonly string[]>> = {
  "model/gltf-binary": ["glb"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "audio/mpeg": ["mp3"],
  "audio/ogg": ["ogg"],
  "audio/wav": ["wav"],
};

export const assetKindOf = (mime: ProjectAssetMime): ProjectAssetKind =>
  mime === "model/gltf-binary" ? "model" : mime.startsWith("image/") ? "image" : "audio";

export const extensionMatches = (name: string, mime: ProjectAssetMime): boolean =>
  EXTENSIONS[mime].includes(name.slice(name.lastIndexOf(".") + 1));

export const mimeOfName = (name: string): ProjectAssetMime | null =>
  PROJECT_ASSET_MIMES.find((mime) => extensionMatches(name, mime)) ?? null;

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const at = (bytes: Uint8Array, offset: number, magic: readonly number[]) =>
  magic.every((b, i) => bytes[offset + i] === b);
const mpegSync = (bytes: Uint8Array) => bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;

export function sniffAsset(bytes: Uint8Array): ProjectAssetMime | null {
  if (at(bytes, 0, ascii("glTF"))) return "model/gltf-binary";
  const image = sniffImage(bytes);
  if (image) return image;
  if (at(bytes, 0, ascii("ID3")) || mpegSync(bytes)) return "audio/mpeg";
  if (at(bytes, 0, ascii("OggS"))) return "audio/ogg";
  if (at(bytes, 0, ascii("RIFF")) && at(bytes, 8, ascii("WAVE"))) return "audio/wav";
  return null;
}
