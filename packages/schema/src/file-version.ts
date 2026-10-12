import { z } from "zod";

export const VERSION_ORIGINS = ["kibo", "integrate", "restore", "external", "migration", "delete"] as const;
export const VersionOrigin = z.enum(VERSION_ORIGINS);
export type VersionOrigin = z.infer<typeof VersionOrigin>;
export const VERSIONS_PER_FILE = 100;
export const FileVersionKind = z.enum(["agents", "skills"]);
export type FileVersionKind = z.infer<typeof FileVersionKind>;

export type FileVersion = {
  id: string;
  kind: FileVersionKind;
  ref: string;
  file: string;
  hash: string;
  size: number;
  at: number;
  origin: VersionOrigin;
  by: string | null;
  note: string | null;
  missing: boolean;
};

export type SaveConflict = { content: string; hash: string; modifiedAt: number };
export type SaveResult<T> = { ok: true; value: T } | { ok: false; conflict: SaveConflict };
