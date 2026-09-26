import { cpSync, mkdirSync, renameSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { assertRealDir, guarded, posix, present, removeTree, safeCopy } from "./draft-fs";

const KIBO_ONLY = new Set(["claude.md", ".claude"]);

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

export function releaseSource(srcDir: string, fate: SourceFate): void {
  guarded("release source", () => {
    const backup = sibling(srcDir, "kibo-backup");
    const trash = sibling(srcDir, "kibo-trash");
    if (fate === "published") removeTree(backup);
    recoverAfterCrash(srcDir, backup, trash);
    if (fate === "reserved") removeTree(srcDir);
  });
}
