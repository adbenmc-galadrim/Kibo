import { lstatSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DEMO_PROJECT_KEY } from "@kibo/schema";

export type DemoNotesCleanupDeps = {
  home: string;
  isDemo(projectId: string): boolean;
  notesDir(projectId: string): string;
  log(message: string): void;
};

const lstatOrNull = (path: string) => lstatSync(path, { throwIfNoEntry: false }) ?? null;

function isExpectedFolder(dir: string, expected: string): boolean {
  if (resolve(dir) !== resolve(expected)) return false;
  const notes = lstatOrNull(dirname(expected));
  return notes?.isDirectory() === true && !notes.isSymbolicLink();
}

function removeFolder(dir: string, log: (message: string) => void): void {
  const stat = lstatOrNull(dir);
  if (stat === null) return;
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    log(`demo notes ${dir} are not a plain folder, kept`);
    return;
  }
  rmSync(dir, { recursive: true });
}

export function demoNotesCleanup(deps: DemoNotesCleanupDeps): (projectId: string) => (() => void) | null {
  const expected = join(deps.home, "notes", DEMO_PROJECT_KEY);
  return (projectId) => {
    if (!deps.isDemo(projectId) || !isExpectedFolder(deps.notesDir(projectId), expected)) return null;
    return () => removeFolder(expected, deps.log);
  };
}
