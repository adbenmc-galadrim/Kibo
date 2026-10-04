import { z } from "zod";

export function isSafeNotePath(p: string): boolean {
  if (!p.endsWith(".md") || p.startsWith("/") || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((s) => s.length > 0 && s !== "." && s !== ".." && !s.startsWith("."));
}

export const NotePath = z.string().min(4).max(512).refine(isSafeNotePath, "invalid note path");

export const NoteMeta = z.object({
  path: z.string(),
  title: z.string(),
  mtime: z.number(),
  size: z.number().int().nonnegative(),
  tickets: z.array(z.string()),
  links: z.array(z.string()),
});
export type NoteMeta = z.infer<typeof NoteMeta>;
export const NoteContent = NoteMeta.extend({ markdown: z.string() });
export type NoteContent = z.infer<typeof NoteContent>;

export const NotesInfo = z.object({
  dir: z.string(),
  displayDir: z.string(),
  obsidian: z.boolean(),
  folderRelative: z.string().nullable(),
});
export type NotesInfo = z.infer<typeof NotesInfo>;

export const ASSET_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const AssetMime = z.enum(ASSET_MIMES);
export type AssetMime = z.infer<typeof AssetMime>;
const ASSET_FILE = "[a-z0-9][a-z0-9._-]{0,120}\\.(png|jpe?g|webp|gif)";
export const AssetName = z.string().regex(new RegExp(`^${ASSET_FILE}$`));
export const AssetPath = z.string().regex(new RegExp(`^assets/${ASSET_FILE}$`));
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
export const MAX_ASSET_BASE64 = 2_800_000;

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const SIGNATURES: readonly [AssetMime, readonly (readonly [number, readonly number[]])[]][] = [
  ["image/png", [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]]],
  ["image/jpeg", [[0, [0xff, 0xd8, 0xff]]]],
  ["image/gif", [[0, ascii("GIF8")]]],
  [
    "image/webp",
    [
      [0, ascii("RIFF")],
      [8, ascii("WEBP")],
    ],
  ],
];

export const sniffImage = (bytes: Uint8Array): AssetMime | null =>
  SIGNATURES.find(([, parts]) =>
    parts.every(([offset, magic]) => magic.every((b, i) => bytes[offset + i] === b)),
  )?.[0] ?? null;
