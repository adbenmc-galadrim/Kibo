import { existsSync } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { join, sep } from "node:path";
import { highestVersion, readRegistry } from "@kibo/core";
import { hashSources, readValidationStamp } from "@kibo/devkit";
import { ComponentManifest, type DraftSummary, KiboError } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

const MANIFEST = "kibo.component.json";

export const draftsDir = (home: string): string => join(home, "components", "src");

export async function readDraftManifest(dir: string): Promise<ComponentManifest | null> {
  const file = join(dir, MANIFEST);
  if (!existsSync(file)) return null;
  try {
    const parsed = ComponentManifest.safeParse(JSON.parse(await readFile(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export async function draftDir(home: string, id: string): Promise<string> {
  if (!ComponentManifest.shape.id.safeParse(id).success)
    throw new KiboError("INVALID_INPUT", `invalid component id ${id}`);
  const root = draftsDir(home);
  const dir = join(root, id);
  if (!existsSync(join(dir, MANIFEST))) throw new KiboError("NOT_FOUND", `no draft for ${id}`);
  if ((await lstat(dir)).isSymbolicLink())
    throw new KiboError("INVALID_INPUT", `draft ${id} is a symbolic link`);
  if (!(await realpath(dir)).startsWith(`${await realpath(root)}${sep}`))
    throw new KiboError("INVALID_INPUT", `draft ${id} is outside the drafts folder`);
  return dir;
}

async function hashOrNull(dir: string): Promise<string | null> {
  try {
    return await hashSources(dir);
  } catch (e) {
    if (e instanceof KiboError && e.code === "VALIDATION_FAILED") return null;
    throw e;
  }
}

export async function listDrafts(home: string, workspace: LoroDoc): Promise<DraftSummary[]> {
  const root = draftsDir(home);
  if (!existsSync(root)) return [];
  const registry = readRegistry(workspace);
  const out: DraftSummary[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = join(root, entry.name);
    const manifest = await readDraftManifest(dir);
    if (!manifest || manifest.id !== entry.name) continue;
    const hash = await hashOrNull(dir);
    const published = registry[manifest.id];
    if (hash !== null && published?.versions[manifest.version]?.hash === hash) continue;
    const stamp = await readValidationStamp(dir);
    out.push({
      id: manifest.id,
      title: manifest.title,
      version: manifest.version,
      hash,
      validated:
        hash !== null &&
        stamp !== null &&
        stamp.ok &&
        stamp.hash === hash &&
        stamp.version === manifest.version,
      publishedVersion: published ? highestVersion(published) : null,
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "fr"));
}
