import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isSafeNotePath, KiboError } from "@kibo/schema";
import { isInside } from "../code/safe-path";

export type NoteFile = { markdown: string; mtime: number; size: number };
export const MAX_NOTE_BYTES = 1_048_576;

const outside = (p: string) =>
  new KiboError("PATH_OUTSIDE_PROJECT", `note path ${p} leaves the notes folder`);
const tooLarge = (p: string) => new KiboError("QUOTA_EXCEEDED", `${p} is larger than 1 MiB`);
const notFound = (p: string) => new KiboError("NOT_FOUND", `note ${p} not found`);
const isMissing = (e: unknown) => e instanceof Error && "code" in e && e.code === "ENOENT";
const isExisting = (e: unknown) => e instanceof Error && "code" in e && e.code === "EEXIST";
const mtimeOf = (ms: number) => Math.floor(ms);

async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

export async function resolveNotePath(dir: string, rel: string): Promise<string> {
  if (!isSafeNotePath(rel)) throw outside(rel);
  const root = await realpath(dir);
  const full = join(root, ...rel.split("/"));
  if (full === root || !isInside(root, full)) throw outside(rel);
  let current = root;
  for (const segment of rel.split("/")) {
    current = join(current, segment);
    const info = await lstatOrNull(current);
    if (info === null) break;
    if (info.isSymbolicLink()) throw outside(rel);
  }
  return full;
}

export async function listNoteFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (abs: string, rel: string) => {
    for (const entry of await readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(abs, entry.name), childRel);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(childRel);
    }
  };
  await walk(await realpath(dir), "");
  return out.sort();
}

export async function readNoteFile(dir: string, rel: string): Promise<NoteFile> {
  const full = await resolveNotePath(dir, rel);
  try {
    const info = await stat(full);
    if (!info.isFile()) throw notFound(rel);
    if (info.size > MAX_NOTE_BYTES) throw tooLarge(rel);
    return { markdown: await readFile(full, "utf8"), mtime: mtimeOf(info.mtimeMs), size: info.size };
  } catch (e) {
    if (isMissing(e)) throw notFound(rel);
    throw e;
  }
}

async function replaceAtomically(full: string, bytes: Uint8Array): Promise<void> {
  const temp = join(dirname(full), `.${basename(full)}.${crypto.randomUUID()}.tmp`);
  try {
    await writeFile(temp, bytes, { flag: "wx" });
    await rename(temp, full);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function writeNoteFile(
  dir: string,
  rel: string,
  markdown: string,
  expectedMtime: number | null,
): Promise<NoteFile> {
  const bytes = new TextEncoder().encode(markdown);
  if (bytes.byteLength > MAX_NOTE_BYTES) throw tooLarge(rel);
  const full = await resolveNotePath(dir, rel);
  if (expectedMtime !== null) {
    const current = await lstatOrNull(full);
    if (current === null || mtimeOf(current.mtimeMs) !== expectedMtime)
      throw new KiboError("CONFLICT", `${rel} changed on disk`);
  }
  await mkdir(dirname(full), { recursive: true });
  await resolveNotePath(dir, rel);
  await replaceAtomically(full, bytes);
  const info = await stat(full);
  return { markdown, mtime: mtimeOf(info.mtimeMs), size: info.size };
}

export async function createNoteFile(dir: string, rel: string, markdown: string): Promise<NoteFile> {
  const bytes = new TextEncoder().encode(markdown);
  if (bytes.byteLength > MAX_NOTE_BYTES) throw tooLarge(rel);
  const full = await resolveNotePath(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await resolveNotePath(dir, rel);
  try {
    await writeFile(full, bytes, { flag: "wx" });
  } catch (e) {
    if (isExisting(e)) throw new KiboError("CONFLICT", `${rel} already exists`);
    throw e;
  }
  const info = await stat(full);
  return { markdown, mtime: mtimeOf(info.mtimeMs), size: info.size };
}

export async function renameNoteFile(dir: string, from: string, to: string): Promise<void> {
  const source = await resolveNotePath(dir, from);
  const target = await resolveNotePath(dir, to);
  if ((await lstatOrNull(source)) === null) throw notFound(from);
  if ((await lstatOrNull(target)) !== null) throw new KiboError("CONFLICT", `${to} already exists`);
  await mkdir(dirname(target), { recursive: true });
  await resolveNotePath(dir, to);
  await rename(source, target);
}

export async function removeNoteFile(dir: string, rel: string): Promise<void> {
  const full = await resolveNotePath(dir, rel);
  if ((await lstatOrNull(full)) === null) throw notFound(rel);
  await rm(full);
}
