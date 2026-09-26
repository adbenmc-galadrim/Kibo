import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { KiboError } from "@kibo/schema";
import { isHashedSource, type SourceFile, sourceHash } from "@kibo/trust";

export type { SourceFile };

export const MAX_SOURCE_FILES = 200;
export const MAX_SOURCE_BYTES = 2_097_152;

const SKIPPED = new Set(["node_modules", "dist"]);

const comparePaths = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const isHashed = isHashedSource;

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIPPED.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    const rel = relative(root, abs).split(sep).join("/");
    if (entry.isSymbolicLink()) throw new KiboError("VALIDATION_FAILED", `symbolic link not allowed: ${rel}`);
    if (entry.isDirectory()) await walk(root, abs, out);
    else if (entry.isFile()) out.push(rel);
  }
}

export async function listSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  await walk(dir, dir, out);
  return out.sort(comparePaths);
}

export const hashFiles = (files: SourceFile[]): string => sourceHash(files);

export async function readSources(dir: string): Promise<{ hash: string; files: SourceFile[] }> {
  const paths = (await listSourceFiles(dir)).filter(isHashed);
  if (!paths.includes("kibo.component.json")) {
    throw new KiboError("VALIDATION_FAILED", "kibo.component.json is missing");
  }
  if (paths.length > MAX_SOURCE_FILES) {
    throw new KiboError("VALIDATION_FAILED", `more than ${MAX_SOURCE_FILES} source files`);
  }
  const files = await Promise.all(
    paths.map(async (path) => ({ path, bytes: new Uint8Array(await readFile(join(dir, path))) })),
  );
  const total = files.reduce((n, f) => n + f.bytes.byteLength, 0);
  if (total > MAX_SOURCE_BYTES)
    throw new KiboError("VALIDATION_FAILED", `sources exceed ${MAX_SOURCE_BYTES} bytes`);
  return { hash: hashFiles(files), files };
}

export async function hashSources(dir: string): Promise<string> {
  return (await readSources(dir)).hash;
}
