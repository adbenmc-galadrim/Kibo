import { lstatSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DEMO_PROJECT_KEY } from "@kibo/schema";

export const DEMO_NOTES_MARKER = ".kibo-demo";

export type DemoNotesCleanupDeps = {
  home: string;
  isDemo(projectId: string): boolean;
  notesDir(projectId: string): string;
  log(message: string): void;
};

const demoNotesDir = (home: string) => join(home, "notes", DEMO_PROJECT_KEY);
const lstatOrNull = (path: string) => lstatSync(path, { throwIfNoEntry: false }) ?? null;
const isPlainFolder = (path: string) => {
  const stat = lstatOrNull(path);
  return stat?.isDirectory() === true && !stat.isSymbolicLink();
};

function isExpectedFolder(dir: string, expected: string): boolean {
  return resolve(dir) === resolve(expected) && isPlainFolder(dirname(expected));
}

export function prepareDemoNotes(home: string): () => void {
  const dir = demoNotesDir(home);
  const existed = lstatOrNull(dir) !== null;
  return () => {
    if (existed || !isPlainFolder(dirname(dir)) || !isPlainFolder(dir)) return;
    writeFileSync(join(dir, DEMO_NOTES_MARKER), "", { flag: "wx", mode: 0o600 });
  };
}

function removeFolder(dir: string, log: (message: string) => void): void {
  if (lstatOrNull(dir) === null) return;
  if (!isPlainFolder(dir)) {
    log(`demo notes ${dir} are not a plain folder, kept`);
    return;
  }
  if (lstatOrNull(join(dir, DEMO_NOTES_MARKER))?.isFile() !== true) {
    log(`demo notes ${dir} were not created by the demo, kept`);
    return;
  }
  rmSync(dir, { recursive: true });
}

export function demoNotesCleanup(deps: DemoNotesCleanupDeps): (projectId: string) => (() => void) | null {
  const expected = demoNotesDir(deps.home);
  return (projectId) => {
    if (!deps.isDemo(projectId) || !isExpectedFolder(deps.notesDir(projectId), expected)) return null;
    return () => removeFolder(expected, deps.log);
  };
}
