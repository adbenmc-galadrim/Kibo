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
