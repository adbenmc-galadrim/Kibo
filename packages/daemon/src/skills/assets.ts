import { lstat, readdir, realpath } from "node:fs/promises";
import { extname, isAbsolute, join, relative } from "node:path";
import { KiboError, SKILL_ASSET_TEXT_MAX, SKILL_TEXT_EXTENSIONS, type SkillAsset } from "@kibo/schema";
import { isInside } from "../code/safe-path";
import { lstatOrNull } from "../fs/resolve-inside";

export const SKILL_FILE = "SKILL.md";
const ASSETS_MAX = 500;
const DEPTH_MAX = 6;

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(SKILL_TEXT_EXTENSIONS);

export const isTextFile = (path: string, size: number): boolean =>
  size <= SKILL_ASSET_TEXT_MAX && TEXT_EXTENSIONS.has(extname(path).toLowerCase());

export async function listAssets(dir: string): Promise<SkillAsset[]> {
  const assets: SkillAsset[] = [];
  const walk = async (current: string, depth: number): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (assets.length >= ASSETS_MAX) return;
      const full = join(current, entry.name);
      const path = relative(dir, full).split("\\").join("/");
      if (entry.isDirectory() && depth < DEPTH_MAX) await walk(full, depth + 1);
      if (!entry.isFile() || path === SKILL_FILE) continue;
      const { size } = await lstat(full);
      assets.push({ path, size, text: isTextFile(path, size) });
    }
  };
  await walk(dir, 0);
  return assets;
}

const forbidden = (file: string) => new KiboError("FORBIDDEN", `skill file ${file} leaves its folder`);

export async function resolveSkillFile(dir: string, file: string): Promise<string> {
  const parts = file.split("/");
  if (file === "" || isAbsolute(file) || parts.some((p) => p === ".." || p === "" || p === "."))
    throw forbidden(file);
  const root = await realpath(dir);
  const full = join(root, ...parts);
  if (!isInside(root, full) || full === root) throw forbidden(file);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    const info = await lstatOrNull(current);
    if (info === null) break;
    if (info.isSymbolicLink()) throw forbidden(file);
  }
  return join(dir, ...parts);
}
