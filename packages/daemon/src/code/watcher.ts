import { EventEmitter } from "node:events";
import { watch as fsWatch } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export type WatchTarget = { path: string; recursive: boolean };
export type WatchHandle = { mode(): "watch" | "poll"; close(): void };
export type Watcher = { close(): void };
export type WatchFn = (
  path: string,
  options: { recursive: boolean },
  onEvent: (filename: string | null) => void,
  onError: (e: unknown) => void,
) => Watcher;
export type WatchOptions = {
  debounceMs?: number;
  pollMs?: number;
  onError?: (e: unknown) => void;
  watch?: WatchFn;
};

const GIT_STATE_ENTRIES = new Set([
  "HEAD",
  "index",
  "packed-refs",
  "refs",
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "rebase-merge",
  "rebase-apply",
]);

function segments(path: string): string[] {
  return path.split(/[\\/]+/).filter((s) => s !== "" && s !== ".");
}

function contains(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return segments(rel)[0] !== ".." && !isAbsolute(rel);
}

function isGitStateChange(inside: string[]): boolean {
  const own = inside[0] === "worktrees" ? inside.slice(2) : inside;
  const [entry] = own;
  const last = own[own.length - 1];
  if (entry === undefined || last === undefined || last.endsWith(".lock")) return false;
  return GIT_STATE_ENTRIES.has(entry);
}

function isAgentWorktreeChange(all: string[], firstChanged: number): boolean {
  return all.some((s, i) => i + 1 >= firstChanged && s === ".kibo" && all[i + 1] === "worktrees");
}

export function isRelevantChange(targetPath: string, filename: string | null): boolean {
  if (filename === null) return true;
  const base = segments(targetPath);
  const all = [...base, ...segments(filename)];
  if (isAgentWorktreeChange(all, base.length)) return false;
  const gitIndex = all.indexOf(".git");
  return gitIndex === -1 || isGitStateChange(all.slice(gitIndex + 1));
}

export function dedupeTargets(targets: WatchTarget[]): WatchTarget[] {
  const covers = (o: WatchTarget, t: WatchTarget, earlier: boolean) => {
    if (resolve(o.path) === resolve(t.path)) return o.recursive === t.recursive ? earlier : o.recursive;
    return o.recursive && contains(o.path, t.path);
  };
  return targets.filter((t, i) => !targets.some((o, j) => j !== i && covers(o, t, j < i)));
}

const defaultWatch: WatchFn = (path, options, onEvent, onError) => {
  const watcher = fsWatch(path, options, (_event, filename) => onEvent(filename));
  // Two merged @types/node versions (20 and 26) hide the EventEmitter methods of FSWatcher.
  if (!(watcher instanceof EventEmitter)) {
    watcher.close();
    throw new Error("fs.watch returned a watcher without error events");
  }
  watcher.on("error", onError);
  return watcher;
};

export function watchPaths(
  targets: WatchTarget[],
  onChange: () => void,
  opts: WatchOptions = {},
): WatchHandle {
  const report = opts.onError ?? ((e: unknown) => console.error("[kibo-daemon] watcher failed", e));
  const watch = opts.watch ?? defaultWatch;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const watchers: Watcher[] = [];

  const fire = () => {
    if (closed || poll) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, opts.debounceMs ?? 150);
  };
  const closeWatchers = () => {
    for (const w of watchers.splice(0)) w.close();
  };
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const fallBack = (e: unknown) => {
    report(e);
    if (closed || poll) return;
    closeWatchers();
    clearTimer();
    poll = setInterval(onChange, opts.pollMs ?? 3000);
  };

  try {
    for (const t of dedupeTargets(targets)) {
      const onEvent = (filename: string | null) => {
        if (isRelevantChange(t.path, filename)) fire();
      };
      watchers.push(watch(t.path, { recursive: t.recursive }, onEvent, fallBack));
    }
  } catch (e) {
    fallBack(e);
  }

  return {
    mode: () => (poll ? "poll" : "watch"),
    close() {
      if (closed) return;
      closed = true;
      closeWatchers();
      clearTimer();
      if (poll) clearInterval(poll);
      poll = null;
    },
  };
}
