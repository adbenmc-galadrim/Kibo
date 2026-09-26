import { cpSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { ComponentManifest } from "@kibo/schema";
import {
  assertRealDir,
  guarded,
  isRealDir,
  isSafeFile,
  posix,
  present,
  removeTree,
  safeCopy,
} from "./draft-fs";

const KIBO_ONLY = new Set(["claude.md", ".claude"]);
const MANIFEST = "kibo.component.json";

const installable = (dir: string) => {
  const safe = safeCopy(dir);
  return (s: string) => {
    const top = posix(relative(dir, s)).split("/")[0] ?? "";
    return s === dir || (!KIBO_ONLY.has(top.toLowerCase()) && safe(s));
  };
};

const sibling = (srcDir: string, suffix: string) => join(dirname(srcDir), `.${basename(srcDir)}.${suffix}`);

function recoverAfterCrash(srcDir: string, backup: string, trash: string) {
  removeTree(trash);
  if (!present(backup)) return;
  removeTree(srcDir);
  renameSync(backup, srcDir);
}

export function installDraft(dir: string, srcDir: string): { commit(): void; rollback(): void } {
  return guarded("install draft", () => {
    assertRealDir(dir);
    const backup = sibling(srcDir, "kibo-backup");
    const trash = sibling(srcDir, "kibo-trash");
    recoverAfterCrash(srcDir, backup, trash);
    const hadSource = present(srcDir);
    if (hadSource) renameSync(srcDir, backup);
    const undo = () => {
      removeTree(srcDir);
      if (hadSource) renameSync(backup, srcDir);
    };
    try {
      mkdirSync(srcDir, { recursive: true, mode: 0o700 });
      cpSync(dir, srcDir, { recursive: true, filter: installable(dir) });
    } catch (e) {
      undo();
      throw e;
    }
    let settled = false;
    const once = (what: string, action: () => void) => () => {
      if (settled) return;
      settled = true;
      guarded(what, action);
    };
    const dropBackup = () => {
      if (!hadSource) return;
      renameSync(backup, trash);
      removeTree(trash);
    };
    return { commit: once("commit install", dropBackup), rollback: once("roll back install", undo) };
  });
}

export type SourceFate = "published" | "unpublished" | "reserved";

export type SourceIdentity = { id: string; version: string };

export const hasInstallBackup = (srcDir: string): boolean => present(sibling(srcDir, "kibo-backup"));

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export function installedIdentity(srcDir: string): SourceIdentity | null {
  return guarded("read installed source", () => {
    const file = join(srcDir, MANIFEST);
    if (!isRealDir(srcDir) || !isSafeFile(file)) return null;
    const parsed = ComponentManifest.safeParse(readJson(file));
    return parsed.success ? { id: parsed.data.id, version: parsed.data.version } : null;
  });
}

const holds = (srcDir: string, draft: SourceIdentity | null) => {
  if (!present(srcDir)) return true;
  const installed = installedIdentity(srcDir);
  return draft !== null && installed?.id === draft.id && installed.version === draft.version;
};

export function releaseSource(srcDir: string, fate: SourceFate, draft: SourceIdentity | null): boolean {
  return guarded("release source", () => {
    const backup = sibling(srcDir, "kibo-backup");
    const trash = sibling(srcDir, "kibo-trash");
    const hasBackup = present(backup);
    removeTree(trash);
    if (fate === "published") {
      removeTree(backup);
      return true;
    }
    if (!hasBackup && (fate === "unpublished" || !present(srcDir))) return true;
    if (!holds(srcDir, draft)) return false;
    removeTree(srcDir);
    if (hasBackup) renameSync(backup, srcDir);
    return true;
  });
}
