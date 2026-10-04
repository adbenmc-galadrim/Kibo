import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { KiboError } from "@kibo/schema";
import { isInside } from "../code/safe-path";

const isMissing = (e: unknown) => e instanceof Error && "code" in e && e.code === "ENOENT";

export async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

export const outside = (rel: string, label = "note path") =>
  new KiboError("PATH_OUTSIDE_PROJECT", `${label} ${rel} leaves its folder`);

export async function resolveInside(dir: string, rel: string, label = "note path"): Promise<string> {
  if (isAbsolute(rel)) throw outside(rel, label);
  const root = await realpath(dir);
  const full = join(root, ...rel.split("/"));
  if (full === root || !isInside(root, full)) throw outside(rel, label);
  let current = root;
  for (const segment of rel.split("/")) {
    current = join(current, segment);
    const info = await lstatOrNull(current);
    if (info === null) break;
    if (info.isSymbolicLink()) throw outside(rel, label);
  }
  return full;
}
