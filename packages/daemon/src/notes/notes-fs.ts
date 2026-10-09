import { constants } from "node:fs";
import { mkdir, open, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  type AssetMime,
  AssetName,
  AssetPath,
  isSafeNotePath,
  KiboError,
  MAX_ASSET_BYTES,
  MAX_NOTE_CHARS,
  sniffImage,
} from "@kibo/schema";
import { lstatOrNull, outside, resolveInside } from "../fs/resolve-inside";

export type NoteFile = { markdown: string; mtime: number; size: number };
export const MAX_NOTE_BYTES = MAX_NOTE_CHARS;

const tooLarge = (p: string) => new KiboError("QUOTA_EXCEEDED", `${p} is larger than 1 MiB`);
const notFound = (p: string) => new KiboError("NOT_FOUND", `note ${p} not found`);
const isMissing = (e: unknown) => e instanceof Error && "code" in e && e.code === "ENOENT";
const isExisting = (e: unknown) => e instanceof Error && "code" in e && e.code === "EEXIST";
const mtimeOf = (ms: number) => Math.floor(ms);

export async function resolveNotePath(dir: string, rel: string): Promise<string> {
  if (!isSafeNotePath(rel)) throw outside(rel);
  return resolveInside(dir, rel);
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

const ASSETS = "assets";
const MAX_SUFFIX = 100;
const assetTooLarge = (name: string) =>
  new KiboError("TOO_LARGE", `${name} exceeds ${MAX_ASSET_BYTES} bytes`);
const withSuffix = (name: string, n: number): string =>
  n === 1 ? name : name.replace(/(\.[a-z]+)$/, `-${n}$1`);

export async function attachAssetFile(
  dir: string,
  name: string,
  mime: AssetMime,
  bytes: Uint8Array,
): Promise<string> {
  if (!AssetName.safeParse(name).success) throw new KiboError("INVALID_INPUT", `invalid asset name ${name}`);
  if (bytes.byteLength > MAX_ASSET_BYTES) throw assetTooLarge(name);
  if (sniffImage(bytes) !== mime) throw new KiboError("INVALID_INPUT", `${name} is not a ${mime}`);
  await mkdir(await resolveInside(dir, ASSETS), { recursive: true });
  await resolveInside(dir, ASSETS);
  for (let n = 1; n <= MAX_SUFFIX; n++) {
    const rel = `${ASSETS}/${withSuffix(name, n)}`;
    const full = await resolveInside(dir, rel);
    try {
      await writeFile(full, bytes, { flag: "wx" });
      return rel;
    } catch (e) {
      if (!isExisting(e)) throw e;
    }
  }
  throw new KiboError("CONFLICT", `no free name for ${name}`);
}

export async function readAssetFile(
  dir: string,
  rel: string,
): Promise<{ mime: AssetMime; bytes: Uint8Array }> {
  if (!AssetPath.safeParse(rel).success) throw new KiboError("INVALID_INPUT", `invalid asset path ${rel}`);
  const full = await resolveInside(dir, rel);
  let file: Awaited<ReturnType<typeof open>>;
  try {
    file = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (e) {
    if (isMissing(e)) throw new KiboError("NOT_FOUND", `${rel} not found`);
    if (e instanceof Error && "code" in e && e.code === "ELOOP") throw outside(rel);
    throw e;
  }
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new KiboError("NOT_FOUND", `${rel} is not a file`);
    if (info.size > MAX_ASSET_BYTES) throw assetTooLarge(rel);
    const bytes = new Uint8Array(await file.readFile());
    const mime = sniffImage(bytes);
    if (mime === null) throw new KiboError("INVALID_INPUT", `${rel} is not an image`);
    return { mime, bytes };
  } finally {
    await file.close();
  }
}
