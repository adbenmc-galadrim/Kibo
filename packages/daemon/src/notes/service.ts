import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { type ComponentCall, KiboError, type NoteContent, type NoteMeta, type NotesInfo } from "@kibo/schema";
import { isInside } from "../code/safe-path";
import { createNotesIndex, type IndexedNote } from "./index";
import { listNoteFiles, readNoteFile, removeNoteFile, renameNoteFile, writeNoteFile } from "./notes-fs";
import { createProjectSettings } from "./settings";
import { type NotesWatcher, type WatchFn, watchNotes } from "./watch";

export type NotesProject = { id: string; key: string; folder: string | null };
export type NotesServiceDeps = {
  db: Database;
  home: string;
  homeDir?: string;
  project(projectId: string): NotesProject;
  onChange?: (projectId: string) => void;
  watch?: WatchFn;
  debounceMs?: number;
};
export type NotesService = {
  info(projectId: string): NotesInfo;
  setDir(projectId: string, dir: string): Promise<NotesInfo>;
  handle(projectId: string, call: ComponentCall): Promise<unknown>;
  refresh(projectId: string): Promise<void>;
  close(): void;
};

const SKIPPED_NOTE_CODES = new Set(["NOT_FOUND", "QUOTA_EXCEEDED", "PATH_OUTSIDE_PROJECT"]);
const log = (line: string) => console.error(`[kibo-daemon] ${line}`);

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (e) {
    if (e instanceof Error && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return false;
    throw e;
  }
}

async function readAll(dir: string): Promise<IndexedNote[]> {
  const notes: IndexedNote[] = [];
  for (const path of await listNoteFiles(dir)) {
    try {
      const file = await readNoteFile(dir, path);
      notes.push({ path, markdown: file.markdown, mtime: file.mtime, size: file.size });
    } catch (e) {
      if (!(e instanceof KiboError && SKIPPED_NOTE_CODES.has(e.code))) throw e;
      log(`note ${path} skipped: ${e.message}`);
    }
  }
  return notes;
}

export function createNotesService(deps: NotesServiceDeps): NotesService {
  const settings = createProjectSettings(deps.db);
  const index = createNotesIndex(deps.db);
  const homeDir = deps.homeDir ?? homedir();
  const indexed = new Set<string>();
  const watchers = new Map<string, NotesWatcher>();

  const dirOf = (projectId: string): string => {
    const saved = settings.get(projectId, "notesDir");
    if (saved) return saved;
    const p = deps.project(projectId);
    return p.folder ? join(p.folder, "notes") : join(deps.home, "notes", p.key);
  };

  const hasObsidianVault = (dir: string, folder: string | null): boolean => {
    for (let d = dir; ; d = dirname(d)) {
      if (existsSync(join(d, ".obsidian"))) return true;
      if (!folder || d === folder || !isInside(folder, d) || dirname(d) === d) return false;
    }
  };

  const info = (projectId: string): NotesInfo => {
    const dir = dirOf(projectId);
    const folder = deps.project(projectId).folder;
    return {
      dir,
      displayDir: isInside(homeDir, dir) ? `~${dir.slice(homeDir.length)}` : dir,
      obsidian: hasObsidianVault(dir, folder),
      folderRelative: folder && isInside(folder, dir) ? relative(folder, dir) || "." : null,
    };
  };

  const release = (projectId: string) => {
    watchers.get(projectId)?.close();
    watchers.delete(projectId);
  };

  const follow = (projectId: string, dir: string): Promise<void> => {
    const current = watchers.get(projectId);
    if (current) return current.ready;
    const onEvent = () => {
      refresh(projectId).catch((e: unknown) => log(`notes refresh failed for ${projectId}: ${String(e)}`));
    };
    const watcher = watchNotes(dir, onEvent, {
      ...(deps.watch && { watch: deps.watch }),
      ...(deps.debounceMs !== undefined && { debounceMs: deps.debounceMs }),
    });
    watchers.set(projectId, watcher);
    return watcher.ready;
  };

  const refresh = async (projectId: string): Promise<void> => {
    const dir = dirOf(projectId);
    let notes: IndexedNote[] = [];
    if (await isDirectory(dir)) {
      await follow(projectId, dir);
      notes = await readAll(dir);
    } else if (watchers.has(projectId)) {
      release(projectId);
      log(`notes folder ${dir} disappeared, watch released`);
    }
    index.replace(projectId, deps.project(projectId).key, notes);
    indexed.add(projectId);
    deps.onChange?.(projectId);
  };

  const ensure = async (projectId: string) => {
    if (!indexed.has(projectId)) await refresh(projectId);
  };
  const metaOf = async (projectId: string, path: string): Promise<NoteMeta> => {
    await refresh(projectId);
    const meta = index.get(projectId, path);
    if (!meta) throw new KiboError("NOT_FOUND", `note ${path} not found`);
    return meta;
  };

  const usableDir = async (dir: string): Promise<boolean> => {
    try {
      return isAbsolute(dir) && (await isDirectory(dir));
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `${dir} cannot be read: ${String(e)}`);
    }
  };

  return {
    info,
    async setDir(projectId, dir) {
      if (!(await usableDir(dir))) throw new KiboError("INVALID_INPUT", `${dir} is not an existing folder`);
      settings.set(projectId, "notesDir", dir);
      release(projectId);
      await refresh(projectId);
      return info(projectId);
    },
    async handle(projectId, call) {
      const dir = dirOf(projectId);
      switch (call.kind) {
        case "list":
          if (call.entity !== "note") break;
          await ensure(projectId);
          return index.list(projectId);
        case "notes.read": {
          const file = await readNoteFile(dir, call.path);
          await ensure(projectId);
          const meta = index.get(projectId, call.path) ?? (await metaOf(projectId, call.path));
          const content: NoteContent = {
            ...meta,
            mtime: file.mtime,
            size: file.size,
            markdown: file.markdown,
          };
          return content;
        }
        case "notes.write":
          await mkdir(dir, { recursive: true });
          await writeNoteFile(dir, call.path, call.markdown, call.expectedMtime);
          return metaOf(projectId, call.path);
        case "notes.rename":
          await renameNoteFile(dir, call.from, call.to);
          return metaOf(projectId, call.to);
        case "notes.remove":
          await removeNoteFile(dir, call.path);
          await refresh(projectId);
          return null;
        case "notes.search":
          await ensure(projectId);
          return index.search(projectId, call.query);
        case "notes.info":
          return info(projectId);
      }
      throw new KiboError("INTERNAL", `${call.kind} is not a notes call`);
    },
    refresh,
    close() {
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
  };
}
