import { ASSET_MIMES, type AssetMime } from "@kibo/schema";
import { slugify } from "../note-name";

const EXT: Record<AssetMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const pad = (n: number) => String(n).padStart(2, "0");

export const isAssetMime = (type: string): type is AssetMime => ASSET_MIMES.some((m) => m === type);

const stampOf = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;

export function assetNameFor(notePath: string, mime: AssetMime, now: Date): string {
  const base = (notePath.split("/").at(-1) ?? "").replace(/\.md$/, "");
  return `${slugify(base) || "note"}-${stampOf(now)}.${EXT[mime]}`;
}

export function imageFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  return Array.from(data.files).find((f) => isAssetMime(f.type)) ?? null;
}
