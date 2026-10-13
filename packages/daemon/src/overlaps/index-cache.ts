import type { IndexedFile } from "@kibo/schema";

export type FileStat = { size: number; mtimeMs: number };
export type FileContent = Pick<IndexedFile, "hash" | "exports" | "imports" | "lines" | "clipped" | "added">;
type Entry = FileStat & { workspace: string; content: FileContent };

export type IndexCache = {
  get(workspace: string, path: string, stat: FileStat): FileContent | null;
  set(workspace: string, path: string, stat: FileStat, content: FileContent): void;
  forget(workspace: string, path: string): void;
  dropWorkspace(workspace: string): void;
  size(): number;
};

const entryKey = (workspace: string, path: string): string => `${workspace}\0${path}`;

export function createIndexCache(capacity: number): IndexCache {
  const entries = new Map<string, Entry>();
  return {
    get(workspace, path, stat) {
      const key = entryKey(workspace, path);
      const entry = entries.get(key);
      if (!entry || entry.size !== stat.size || entry.mtimeMs !== stat.mtimeMs) return null;
      entries.delete(key);
      entries.set(key, entry);
      return entry.content;
    },
    set(workspace, path, stat, content) {
      const key = entryKey(workspace, path);
      entries.delete(key);
      entries.set(key, { ...stat, workspace, content });
      for (const oldest of entries.keys()) {
        if (entries.size <= capacity) break;
        entries.delete(oldest);
      }
    },
    forget: (workspace, path) => {
      entries.delete(entryKey(workspace, path));
    },
    dropWorkspace(workspace) {
      for (const [key, entry] of entries) if (entry.workspace === workspace) entries.delete(key);
    },
    size: () => entries.size,
  };
}
