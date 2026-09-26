import { chmodSync, lstatSync, readdirSync, rmSync, type Stats } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { KiboError } from "@kibo/schema";

export type EntryKind = "file" | "dir" | "unsafe";

const IGNORED_DIRS = new Set(["node_modules", "dist", ".kibo"]);

export const ignored = (name: string) => IGNORED_DIRS.has(name) || name.endsWith(".tsbuildinfo");
export const posix = (p: string) => p.split(sep).join("/");

const statOf = (p: string): Stats | undefined => lstatSync(p, { throwIfNoEntry: false });
const isSafeStat = (st: Stats) => st.isDirectory() || (st.isFile() && st.nlink === 1);

export const present = (p: string) => statOf(p) !== undefined;
export const isRealDir = (p: string) => statOf(p)?.isDirectory() === true;
export const isSafeFile = (p: string) => {
  const st = statOf(p);
  return st?.isFile() === true && st.nlink === 1;
};
export const isSafeEntry = (p: string) => {
  const st = statOf(p);
  return st !== undefined && isSafeStat(st);
};

export function assertRealDir(dir: string): void {
  if (!isRealDir(dir)) throw new KiboError("STORE_CORRUPT", `draft folder ${dir} is not a directory`);
}

export function guarded<T>(what: string, action: () => T): T {
  try {
    return action();
  } catch (e) {
    if (e instanceof KiboError) throw e;
    throw new KiboError("STORE_CORRUPT", `${what}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function unlockTree(root: string): void {
  if (!isRealDir(root)) return;
  chmodSync(root, 0o700);
  for (const name of readdirSync(root)) unlockTree(join(root, name));
}

export function removeTree(path: string): void {
  unlockTree(path);
  rmSync(path, { recursive: true, force: true });
}

export function listEntries(root: string, trustHardLinks = false): Map<string, EntryKind> {
  const out = new Map<string, EntryKind>();
  const walk = (dir: string) => {
    chmodSync(dir, 0o700);
    for (const name of readdirSync(dir).sort()) {
      if (ignored(name)) continue;
      const abs = join(dir, name);
      const rel = posix(relative(root, abs));
      const st = lstatSync(abs);
      if (st.isDirectory()) {
        out.set(rel, "dir");
        walk(abs);
      } else if (isSafeStat(st)) {
        chmodSync(abs, 0o600);
        out.set(rel, "file");
      } else out.set(rel, trustHardLinks && st.isFile() ? "file" : "unsafe");
    }
  };
  assertRealDir(root);
  walk(root);
  return out;
}

export const safeCopy = (root: string) => (s: string) =>
  s === root || (!ignored(basename(s)) && isSafeEntry(s));
