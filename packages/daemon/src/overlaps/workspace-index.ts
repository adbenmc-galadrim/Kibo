import { lstat, open } from "node:fs/promises";
import { join } from "node:path";
import {
  exportsOf,
  type Hasher,
  importsOf,
  isCodePath,
  isIgnoredPath,
  isSecretPath,
  lineHashes,
} from "@kibo/core";
import {
  DUPLICATION_BINARY_EXTENSIONS,
  DUPLICATION_LIMITS,
  type DuplicationSettings,
  type IndexedFile,
  type WorkspaceIndex,
} from "@kibo/schema";
import type { GitRunner } from "../agents/workspace-prep";
import { type AddedLine, addedLinesOf, type DiffFile, type GitDiff, gitDiffSummary } from "./git-diff";
import { createIndexCache, type FileContent, type FileStat, type IndexCache } from "./index-cache";
import type { WorkspaceRef } from "./workspace";

export type IndexFs = {
  stat(p: string): Promise<FileStat | null>;
  read(p: string, max: number): Promise<Buffer | null>;
};

export type WorkspaceIndexer = {
  index(ws: WorkspaceRef, runIds: string[], settings: DuplicationSettings): Promise<WorkspaceIndex>;
  indexFile(ws: WorkspaceRef, path: string, settings: DuplicationSettings): Promise<WorkspaceIndex | null>;
  cached(ws: Pick<WorkspaceRef, "key" | "baseHead">): WorkspaceIndex | null;
  drop(key: string): void;
};

export type IndexerDeps = {
  git: GitRunner;
  fs: IndexFs;
  now: () => number;
  hash: Hasher;
  log: (line: string) => void;
  cache?: IndexCache;
};

type Entry = DiffFile & { untracked: boolean };
type Pass = { ws: WorkspaceRef; settings: DuplicationSettings; partial: boolean };

const NUL_PROBE_BYTES = 8_192;

export const nodeIndexFs: IndexFs = {
  async stat(p) {
    const s = await lstat(p).catch(() => null);
    return s?.isFile() ? { size: s.size, mtimeMs: s.mtimeMs } : null;
  },
  async read(p, max) {
    const handle = await open(p, "r").catch(() => null);
    if (!handle) return null;
    try {
      const buf = Buffer.alloc(max);
      const { bytesRead } = await handle.read(buf, 0, max, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  },
};

const byPath = (a: { path: string }, b: { path: string }): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

const entriesOf = (diff: GitDiff): Entry[] =>
  [
    ...diff.files.map((f) => ({ ...f, untracked: false })),
    ...diff.untracked.map((path) => ({
      path,
      status: "added" as const,
      added: 0,
      removed: 0,
      untracked: true,
    })),
  ].sort(byPath);

const allLines = (text: string): AddedLine[] => {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((t, i) => ({ line: i + 1, text: t }));
};

const extension = (path: string): string => path.slice(path.lastIndexOf(".") + 1).toLowerCase();

const withoutLines = (f: IndexedFile): IndexedFile => ({ ...f, lines: [] });

export function createWorkspaceIndexer(deps: IndexerDeps): WorkspaceIndexer {
  const { git, fs, log } = deps;
  const cache = deps.cache ?? createIndexCache(DUPLICATION_LIMITS.cacheFiles);
  const indexes = new Map<string, WorkspaceIndex>();
  const reportedSecrets = new Map<string, Set<string>>();

  const partial = (pass: Pass, what: string, e: unknown): void => {
    pass.partial = true;
    log(`overlaps: détection partielle in ${pass.ws.key}, ${what}: ${String(e)}`);
  };

  const reportSecret = (key: string, path: string): void => {
    const reported = reportedSecrets.get(key) ?? new Set<string>();
    if (!reported.has(path)) log(`overlaps: secret file ${path} never indexed`);
    reportedSecrets.set(key, reported.add(path));
  };

  const admitted = (key: string, path: string, settings: DuplicationSettings): boolean => {
    if (isSecretPath(path)) {
      reportSecret(key, path);
      return false;
    }
    return !isIgnoredPath(path, settings) && !DUPLICATION_BINARY_EXTENSIONS.includes(extension(path));
  };

  async function addedLines(pass: Pass, entry: Entry, text: string): Promise<AddedLine[] | null> {
    if (entry.status === "added") return allLines(text);
    try {
      return await addedLinesOf(git, pass.ws.key, pass.ws.baseHead, entry.path);
    } catch (e) {
      partial(pass, `diff of ${entry.path}`, e);
      return null;
    }
  }

  async function contentOf(pass: Pass, entry: Entry, text: string): Promise<FileContent | null> {
    const lines = await addedLines(pass, entry, text);
    if (!lines) return null;
    const clipped = lines.length > DUPLICATION_LIMITS.addedLinesPerFile;
    const code = isCodePath(entry.path);
    return {
      hash: deps.hash(text),
      exports: code
        ? exportsOf(
            lines.map((l) => l.text),
            pass.settings.genericExports,
          )
        : [],
      imports: code ? importsOf(lines) : [],
      lines: clipped ? [] : lineHashes(lines, deps.hash),
      clipped,
      added: lines.length,
    };
  }

  async function readContent(pass: Pass, entry: Entry, stat: FileStat): Promise<FileContent | null> {
    const buf = await fs.read(join(pass.ws.key, entry.path), DUPLICATION_LIMITS.fileBytes);
    if (!buf || buf.subarray(0, NUL_PROBE_BYTES).includes(0)) return null;
    const content = await contentOf(pass, entry, buf.toString("utf8"));
    if (content) cache.set(pass.ws.key, entry.path, stat, content);
    return content;
  }

  async function fileOf(pass: Pass, entry: Entry): Promise<IndexedFile | null> {
    const base = { path: entry.path, status: entry.status, added: entry.added, removed: entry.removed };
    if (entry.status === "deleted")
      return { ...base, hash: null, exports: [], imports: [], lines: [], clipped: false };
    const stat = await fs.stat(join(pass.ws.key, entry.path));
    if (!stat) return null;
    if (stat.size > DUPLICATION_LIMITS.fileBytes) {
      log(`overlaps: ${entry.path} skipped, larger than ${DUPLICATION_LIMITS.fileBytes} bytes`);
      return null;
    }
    const content = cache.get(pass.ws.key, entry.path, stat) ?? (await readContent(pass, entry, stat));
    if (!content) return null;
    const { added, ...rest } = content;
    return { ...base, ...rest, added: entry.untracked ? added : entry.added };
  }

  async function filesOf(pass: Pass, entries: Entry[]): Promise<IndexedFile[]> {
    const files: IndexedFile[] = [];
    for (const entry of entries) {
      const file = await fileOf(pass, entry);
      if (file) files.push(file);
    }
    return files;
  }

  async function diffOf(pass: Pass, paths: string[] = []): Promise<Entry[] | null> {
    try {
      return entriesOf(await gitDiffSummary(git, pass.ws.key, pass.ws.baseHead, paths));
    } catch (e) {
      partial(pass, "git diff", e);
      return null;
    }
  }

  function bounded(files: IndexedFile[], truncated: boolean, key: string): IndexedFile[] {
    if (truncated) return files.map(withoutLines);
    let windows = 0;
    return files.map((f) => {
      windows += f.lines.length;
      if (windows <= DUPLICATION_LIMITS.windowsPerWorkspace) return f;
      log(
        `overlaps: ${key} past ${DUPLICATION_LIMITS.windowsPerWorkspace} windows, ${f.path} not compared by block`,
      );
      return { ...withoutLines(f), clipped: true };
    });
  }

  function remember(pass: Pass, runIds: string[], all: IndexedFile[], truncated: boolean): WorkspaceIndex {
    const index: WorkspaceIndex = {
      key: pass.ws.key,
      runIds,
      baseHead: pass.ws.baseHead,
      files: bounded(all, truncated, pass.ws.key),
      truncated,
      partial: pass.partial,
      at: deps.now(),
    };
    indexes.set(pass.ws.key, index);
    return index;
  }

  const cached = (ws: Pick<WorkspaceRef, "key" | "baseHead">): WorkspaceIndex | null => {
    const known = indexes.get(ws.key);
    return known?.baseHead === ws.baseHead ? known : null;
  };

  const drop = (key: string): void => {
    indexes.delete(key);
    reportedSecrets.delete(key);
    cache.dropWorkspace(key);
  };

  async function index(
    ws: WorkspaceRef,
    runIds: string[],
    settings: DuplicationSettings,
  ): Promise<WorkspaceIndex> {
    if (indexes.has(ws.key) && !cached(ws)) drop(ws.key);
    const pass: Pass = { ws, settings, partial: false };
    const entries = await diffOf(pass);
    if (!entries) return remember(pass, runIds, indexes.get(ws.key)?.files ?? [], false);
    const kept = entries.filter((e) => admitted(ws.key, e.path, settings));
    const truncated = kept.length > DUPLICATION_LIMITS.filesPerWorkspace;
    if (truncated)
      log(`overlaps: ${ws.key} has ${kept.length} changed files, only the first 500 are indexed`);
    const files = await filesOf(pass, kept.slice(0, DUPLICATION_LIMITS.filesPerWorkspace));
    return remember(pass, runIds, files, truncated);
  }

  async function indexFile(ws: WorkspaceRef, path: string, settings: DuplicationSettings) {
    if (!admitted(ws.key, path, settings)) return null;
    const current = cached(ws);
    if (!current) return index(ws, [], settings);
    cache.forget(ws.key, path);
    const pass: Pass = { ws, settings, partial: current.partial };
    const entries = await diffOf(pass, [path]);
    if (!entries) return remember(pass, current.runIds, current.files, current.truncated);
    const files = current.files
      .filter((f) => f.path !== path)
      .concat(await filesOf(pass, entries))
      .sort(byPath);
    const truncated = current.truncated || files.length > DUPLICATION_LIMITS.filesPerWorkspace;
    return remember(pass, current.runIds, files.slice(0, DUPLICATION_LIMITS.filesPerWorkspace), truncated);
  }

  return {
    index,
    indexFile,
    cached,
    drop,
  };
}
