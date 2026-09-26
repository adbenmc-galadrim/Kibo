import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { MAX_EVENT_PATHS } from "@kibo/schema";
import { parseStatus } from "./parse-status";
import type { WorktreeHandle } from "./repo";
import { type ChangedPaths, type WatchHandle, watchPaths } from "./watcher";

export type WorktreeWatch = {
  touch(projectId: string, h: WorktreeHandle): Promise<void>;
  settle(projectId: string, h: WorktreeHandle): Promise<void>;
  stop(): void;
};
export type WorktreeWatchOptions = {
  idleMs: number;
  onChange(projectId: string, worktree: string, paths: string[] | undefined): void;
  log(what: string): (e: unknown) => void;
};
type Entry = {
  projectId: string;
  worktree: WorktreeHandle;
  handle: WatchHandle;
  lastRead: number;
  signature: string;
  pending: Set<string> | null;
};

const VANISH_CHECK_MS = 1_000;

function mergePaths(pending: Set<string> | null, paths: ChangedPaths): Set<string> | null {
  if (pending === null || paths === null) return null;
  const merged = new Set([...pending, ...paths]);
  return merged.size > MAX_EVENT_PATHS ? null : merged;
}

function fileStamp(root: string, path: string): string {
  const stat = lstatSync(join(root, path), { throwIfNoEntry: false });
  return stat ? `${path}:${stat.size}:${stat.mtimeMs}` : `${path}:-`;
}

async function signatureOf(h: WorktreeHandle): Promise<string> {
  const [status, refs] = await Promise.all([
    h.git.ok(["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"]),
    h.git.ok(["for-each-ref", "--format=%(objectname) %(refname)", "refs/heads", "refs/remotes"]),
  ]);
  const stamps = parseStatus(status).entries.map((e) => fileStamp(h.path, e.path));
  return [status, refs, ...stamps].join("\n");
}

export function createWorktreeWatch(opts: WorktreeWatchOptions): WorktreeWatch {
  const entries = new Map<string, Entry>();
  let stopped = false;
  const keyOf = (projectId: string, h: WorktreeHandle) => `${projectId}\0${h.path}`;

  const vanished = (projectId: string, h: WorktreeHandle): boolean => {
    if (existsSync(h.path)) return false;
    const key = keyOf(projectId, h);
    const entry = entries.get(key);
    if (entry) {
      entry.handle.close();
      entries.delete(key);
      opts.log("worktree disappeared, watch released")(h.path);
    }
    return true;
  };
  const unlessVanished = (projectId: string, h: WorktreeHandle, what: string) => (e: unknown) => {
    if (!vanished(projectId, h)) opts.log(what)(e);
  };

  const refresh = async (projectId: string, h: WorktreeHandle, paths: ChangedPaths) => {
    const entry = entries.get(keyOf(projectId, h));
    if (!entry || vanished(projectId, h)) return;
    entry.pending = mergePaths(entry.pending, paths);
    const signature = await signatureOf(h);
    if (entries.get(keyOf(projectId, h)) !== entry || signature === entry.signature) return;
    entry.signature = signature;
    const changed = entry.pending ? [...entry.pending] : undefined;
    entry.pending = new Set();
    opts.onChange(projectId, h.path, changed);
  };

  const watch = (projectId: string, h: WorktreeHandle) =>
    watchPaths(
      [
        { path: h.path, recursive: true },
        { path: h.gitDir, recursive: false },
        { path: h.commonDir, recursive: true },
      ],
      (paths) =>
        void refresh(projectId, h, paths).catch(
          unlessVanished(projectId, h, `git refresh failed for ${h.path}`),
        ),
      { root: h.path, onError: unlessVanished(projectId, h, `watcher failed for ${h.path}`) },
    );

  const sweep = setInterval(
    () => {
      for (const [key, entry] of entries) {
        if (vanished(entry.projectId, entry.worktree) || Date.now() - entry.lastRead < opts.idleMs) continue;
        entry.handle.close();
        entries.delete(key);
      }
    },
    Math.min(opts.idleMs, VANISH_CHECK_MS),
  );

  return {
    async touch(projectId, h) {
      const key = keyOf(projectId, h);
      const current = vanished(projectId, h) ? undefined : entries.get(key);
      if (current) {
        current.lastRead = Date.now();
        return;
      }
      const signature = await signatureOf(h);
      if (stopped || entries.has(key)) return;
      entries.set(key, {
        projectId,
        worktree: h,
        handle: watch(projectId, h),
        lastRead: Date.now(),
        signature,
        pending: new Set(),
      });
    },
    async settle(projectId, h) {
      const entry = entries.get(keyOf(projectId, h));
      if (entry) entry.signature = await signatureOf(h);
    },
    stop() {
      stopped = true;
      clearInterval(sweep);
      for (const entry of entries.values()) entry.handle.close();
      entries.clear();
    },
  };
}
