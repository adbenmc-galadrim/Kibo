import { lstatSync } from "node:fs";
import { join } from "node:path";
import { parseStatus } from "./parse-status";
import type { WorktreeHandle } from "./repo";
import { type WatchHandle, watchPaths } from "./watcher";

export type WorktreeWatch = {
  touch(projectId: string, h: WorktreeHandle): Promise<void>;
  settle(projectId: string, h: WorktreeHandle): Promise<void>;
  stop(): void;
};
export type WorktreeWatchOptions = {
  idleMs: number;
  onChange(projectId: string, worktree: string): void;
  log(what: string): (e: unknown) => void;
};
type Entry = { handle: WatchHandle; lastRead: number; signature: string };

const MAX_SWEEP_MS = 60_000;

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

  const refresh = async (projectId: string, h: WorktreeHandle) => {
    const entry = entries.get(keyOf(projectId, h));
    if (!entry) return;
    const signature = await signatureOf(h);
    if (entries.get(keyOf(projectId, h)) !== entry || signature === entry.signature) return;
    entry.signature = signature;
    opts.onChange(projectId, h.path);
  };

  const watch = (projectId: string, h: WorktreeHandle) =>
    watchPaths(
      [
        { path: h.path, recursive: true },
        { path: h.gitDir, recursive: false },
        { path: h.commonDir, recursive: true },
      ],
      () => void refresh(projectId, h).catch(opts.log(`git refresh failed for ${h.path}`)),
      { onError: opts.log(`watcher failed for ${h.path}`) },
    );

  const sweep = setInterval(
    () => {
      for (const [key, entry] of entries) {
        if (Date.now() - entry.lastRead < opts.idleMs) continue;
        entry.handle.close();
        entries.delete(key);
      }
    },
    Math.min(opts.idleMs, MAX_SWEEP_MS),
  );

  return {
    async touch(projectId, h) {
      const key = keyOf(projectId, h);
      const current = entries.get(key);
      if (current) {
        current.lastRead = Date.now();
        return;
      }
      const signature = await signatureOf(h);
      if (stopped || entries.has(key)) return;
      entries.set(key, { handle: watch(projectId, h), lastRead: Date.now(), signature });
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
