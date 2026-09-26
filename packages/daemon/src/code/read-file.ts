import { lstatSync, readFileSync, statSync } from "node:fs";
import { type FileContent, type FileRevision, KiboError } from "@kibo/schema";
import type { WorktreeHandle } from "./repo";
import { firstLine } from "./run";
import { resolveInWorktree } from "./safe-path";

export const MAX_FILE_BYTES = 1_000_000;
const BINARY_PROBE_BYTES = 8000;

export type Blob = { sha: string; size: number };
type Meta = { modifiedAt: number | null; tracked: boolean; dirty: boolean };

export const sha1 = (bytes: Uint8Array): string => new Bun.CryptoHasher("sha1").update(bytes).digest("hex");

export async function optional(h: WorktreeHandle, args: string[]): Promise<string> {
  const r = await h.git.run(args);
  if (r.code === 0) return r.stdout.trim();
  if (r.code === 1) return "";
  throw new KiboError("GIT_FAILED", `git ${args[0]}: ${firstLine(r.stderr) || `exit ${r.code}`}`);
}

const records = (raw: string): string[] => raw.split("\0").filter(Boolean);

function splitRecord(record: string): { fields: string[]; path: string } {
  const tab = record.indexOf("\t");
  return { fields: record.slice(0, tab).split(/ +/), path: record.slice(tab + 1) };
}

export async function headBlob(h: WorktreeHandle, path: string): Promise<Blob | null> {
  if ((await optional(h, ["rev-parse", "--verify", "-q", "HEAD"])) === "") return null;
  for (const record of records(await h.git.ok(["ls-tree", "-l", "-z", "HEAD", "--", path]))) {
    const { fields, path: entry } = splitRecord(record);
    const [, type, sha, size] = fields;
    if (entry === path && type === "blob" && sha) return { sha, size: Number(size) };
  }
  return null;
}

export async function indexBlob(h: WorktreeHandle, path: string): Promise<Blob | null> {
  for (const record of records(await h.git.ok(["ls-files", "-s", "-z", "--", path]))) {
    const { fields, path: entry } = splitRecord(record);
    const sha = fields[1];
    if (entry === path && sha) return { sha, size: Number((await h.git.ok(["cat-file", "-s", sha])).trim()) };
  }
  return null;
}

export const blobSize = (blob: Blob | null): number | null => blob?.size ?? null;

export function worktreeSize(abs: string): number | null {
  return lstatSync(abs, { throwIfNoEntry: false })?.size ?? null;
}

async function blobBytes(h: WorktreeHandle, sha: string): Promise<Uint8Array> {
  const r = await h.git.run(["cat-file", "blob", sha]);
  if (r.code !== 0)
    throw new KiboError("GIT_FAILED", `git cat-file: ${firstLine(r.stderr) || `exit ${r.code}`}`);
  return r.bytes;
}

function describe(path: string, revision: FileRevision, bytes: Uint8Array, meta: Meta): FileContent {
  const binary = bytes.subarray(0, BINARY_PROBE_BYTES).includes(0);
  const content = binary ? null : new TextDecoder().decode(bytes);
  const lines = content === null ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
  return {
    path,
    revision,
    content,
    hash: sha1(bytes),
    size: bytes.length,
    binary,
    tooLarge: false,
    lines,
    ...meta,
  };
}

function tooLarge(path: string, revision: FileRevision, size: number, meta: Meta): FileContent {
  return {
    path,
    revision,
    content: null,
    hash: null,
    size,
    binary: false,
    tooLarge: true,
    lines: 0,
    ...meta,
  };
}

async function readMeta(h: WorktreeHandle, path: string): Promise<Omit<Meta, "modifiedAt">> {
  const [listed, status] = await Promise.all([
    h.git.ok(["ls-files", "-z", "--", path]),
    h.git.ok(["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", path]),
  ]);
  return { tracked: records(listed).includes(path), dirty: status.length > 0 };
}

async function readRevision(h: WorktreeHandle, path: string, revision: FileRevision, meta: Meta) {
  const blob = revision === "index" ? await indexBlob(h, path) : await headBlob(h, path);
  if (!blob) return describe(path, revision, new Uint8Array(), meta);
  if (blob.size > MAX_FILE_BYTES) return tooLarge(path, revision, blob.size, meta);
  return describe(path, revision, await blobBytes(h, blob.sha), meta);
}

export async function readFile(
  h: WorktreeHandle,
  path: string,
  revision: FileRevision,
): Promise<FileContent> {
  const abs = resolveInWorktree(h.path, path);
  const base = await readMeta(h, path);
  if (revision !== "worktree") return readRevision(h, path, revision, { ...base, modifiedAt: null });
  const stat = statSync(abs, { throwIfNoEntry: false });
  if (!stat?.isFile()) throw new KiboError("NOT_FOUND", `${path} is not a file of the worktree`);
  const meta = { ...base, modifiedAt: Math.round(stat.mtimeMs) };
  if (stat.size > MAX_FILE_BYTES) return tooLarge(path, revision, stat.size, meta);
  return describe(path, revision, new Uint8Array(readFileSync(abs)), meta);
}
