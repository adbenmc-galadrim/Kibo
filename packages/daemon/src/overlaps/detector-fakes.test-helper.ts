import type { IndexedFile, WorkspaceIndex } from "@kibo/schema";
import type { WorkspaceRef } from "./workspace";
import type { WorkspaceIndexer } from "./workspace-index";

export const indexedFile = (path: string, exports: string[] = [], hash = `${path}:${exports.join(",")}`) =>
  ({
    path,
    status: "added",
    added: 1,
    removed: 0,
    hash,
    exports,
    imports: [],
    lines: [],
    clipped: false,
  }) satisfies IndexedFile;

export const indexOf = (key: string, files: IndexedFile[], partial = false): WorkspaceIndex => ({
  key,
  runIds: [],
  baseHead: "base",
  files,
  truncated: false,
  partial,
  at: 0,
});

export const wsRef = (key: string): WorkspaceRef => ({
  key,
  kind: "worktree",
  worktreeName: key.slice(key.lastIndexOf("/") + 1),
  baseHead: "base",
});

export type FakeIndexer = WorkspaceIndexer & {
  full: Map<string, WorkspaceIndex | Error>;
  single: Map<string, WorkspaceIndex | null>;
  calls: string[];
  dropped: string[];
  preload(index: WorkspaceIndex): void;
  onIndex(key: string): void;
};

export function fakeIndexer(): FakeIndexer {
  const memory = new Map<string, WorkspaceIndex>();
  const remember = (index: WorkspaceIndex): WorkspaceIndex => {
    memory.set(index.key, index);
    return index;
  };
  const fake: FakeIndexer = {
    full: new Map(),
    single: new Map(),
    calls: [],
    dropped: [],
    preload: (index) => {
      remember(index);
    },
    onIndex: () => undefined,
    async index(ws) {
      fake.calls.push(`index ${ws.key}`);
      fake.onIndex(ws.key);
      const found = fake.full.get(ws.key) ?? indexOf(ws.key, []);
      if (found instanceof Error) throw found;
      return remember(found);
    },
    async indexFile(ws, path) {
      fake.calls.push(`file ${ws.key} ${path}`);
      const found = fake.single.get(`${ws.key}:${path}`);
      if (found === undefined) return memory.get(ws.key) ?? null;
      return found && remember(found);
    },
    cached: (key) => memory.get(key) ?? null,
    drop(key) {
      fake.dropped.push(key);
      memory.delete(key);
    },
  };
  return fake;
}
