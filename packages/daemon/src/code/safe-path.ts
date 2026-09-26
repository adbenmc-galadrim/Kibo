import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { KiboError } from "@kibo/schema";

const refuse = (detail: string) => new KiboError("PATH_OUTSIDE_PROJECT", detail);

export function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function exists(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
}

function nearestExisting(path: string): string {
  let current = path;
  while (!exists(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function realpathOrRefuse(path: string, relPath: string): string {
  try {
    return realpathSync(path);
  } catch (e) {
    throw refuse(`${relPath} cannot be resolved: ${String(e)}`);
  }
}

function assertRelativeSegments(relPath: string): void {
  if (relPath === "" || relPath.includes("\0") || isAbsolute(relPath))
    throw refuse(`${relPath} is not a relative path`);
  const segments = relPath.split(/[\\/]/);
  if (segments.includes("..")) throw refuse(`${relPath} leaves the worktree`);
  if (segments.some((s) => s.toLowerCase() === ".git")) throw refuse(`${relPath} is inside .git`);
}

export function resolveInWorktree(root: string, relPath: string): string {
  assertRelativeSegments(relPath);
  const realRoot = realpathSync(root);
  const abs = resolve(realRoot, relPath);
  if (!isInside(realRoot, abs)) throw refuse(`${relPath} leaves the worktree`);
  const anchor = realpathOrRefuse(nearestExisting(abs), relPath);
  if (!isInside(realRoot, anchor)) throw refuse(`${relPath} resolves outside the worktree`);
  return abs;
}

export function assertNotSymlink(abs: string): void {
  if (lstatSync(abs, { throwIfNoEntry: false })?.isSymbolicLink()) throw refuse(`${abs} is a symbolic link`);
}
