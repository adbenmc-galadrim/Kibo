import { z } from "zod";

export const ADD_DIRS_MAX = 20;
export const FORBIDDEN_HOME_DIRS: readonly string[] = [".kibo", ".ssh", ".gnupg", ".aws", ".config"];
const CLAUDE_ROOT = ".claude";
const hasControl = (path: string): boolean => [...path].some((c) => c.charCodeAt(0) < 32);

const partsOf = (path: string): string[] => path.split("/").filter((s) => s.length > 0);

export function isSafeAddDir(path: string, home: string): boolean {
  const root = partsOf(home);
  if (!path.startsWith("/") || !home.startsWith("/") || root.length === 0 || hasControl(path)) return false;
  const parts = partsOf(path);
  if (parts.some((s) => s === ".." || s === ".")) return false;
  if (parts.length <= root.length || !root.every((s, i) => parts[i] === s)) return false;
  const [first = "", ...rest] = parts.slice(root.length);
  if (FORBIDDEN_HOME_DIRS.includes(first)) return false;
  return !(first === CLAUDE_ROOT && rest.length === 0);
}

export const AddDirs = z.array(z.string().min(1).max(4096)).max(ADD_DIRS_MAX);
export type AddDirs = z.infer<typeof AddDirs>;
