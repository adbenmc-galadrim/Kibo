import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { writeAtomically } from "./atomic-write";

export type DiskContent = { content: string; hash: string; modifiedAt: number };
export type GuardedWrite =
  | { kind: "written"; hash: string; modifiedAt: number }
  | { kind: "conflict"; current: DiskContent }
  | { kind: "missing" };
export type GuardedWriteInput = {
  path: string;
  content: string;
  baseHash: string | null;
  lastSeen: string | null;
  mode: number;
  onExternal?(current: DiskContent): Promise<void>;
};

export const contentHash = (content: string): string => createHash("sha256").update(content).digest("hex");

const isMissing = (e: unknown): boolean =>
  typeof e === "object" && e !== null && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR");

export async function readWithHash(path: string): Promise<DiskContent | null> {
  try {
    const content = await readFile(path, "utf8");
    const { mtimeMs } = await stat(path);
    return { content, hash: contentHash(content), modifiedAt: Math.floor(mtimeMs) };
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

export async function writeGuarded(input: GuardedWriteInput): Promise<GuardedWrite> {
  const current = await readWithHash(input.path);
  if (current === null && input.baseHash !== null) return { kind: "missing" };
  if (current !== null && current.hash !== input.baseHash) return { kind: "conflict", current };
  if (current !== null && current.hash !== input.lastSeen) await input.onExternal?.(current);
  await writeAtomically(input.path, input.content, input.mode);
  const { mtimeMs } = await stat(input.path);
  return { kind: "written", hash: contentHash(input.content), modifiedAt: Math.floor(mtimeMs) };
}
