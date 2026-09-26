import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_EVENT_PATHS } from "@kibo/schema";
import { dedupeTargets, isRelevantChange, type WatchFn, type WatchHandle, watchPaths } from "./watcher";

let dir: string;
let handles: WatchHandle[];

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-watch-")));
  mkdirSync(join(dir, "src"));
  handles = [];
});

afterEach(() => {
  for (const h of handles) h.close();
  rmSync(dir, { recursive: true, force: true });
});

const SETTLE_MS = 300;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await wait(10);
  }
}

function track(handle: WatchHandle): WatchHandle {
  handles.push(handle);
  return handle;
}

type FakeWatcher = {
  closed: boolean;
  close(): void;
  emit(filename: string | null): void;
  fail(e: unknown): void;
};

function fakeWatch(failAt: number | null = null): { watch: WatchFn; watchers: FakeWatcher[] } {
  const watchers: FakeWatcher[] = [];
  const watch: WatchFn = (_path, _options, onEvent, onError) => {
    if (watchers.length === failAt) {
      throw Object.assign(new Error("too many open files"), { code: "EMFILE" });
    }
    const w: FakeWatcher = {
      closed: false,
      close() {
        w.closed = true;
      },
      emit: onEvent,
      fail: onError,
    };
    watchers.push(w);
    return w;
  };
  return { watch, watchers };
}

test("a burst of writes produces a single debounced call", async () => {
  let calls = 0;
  const handle = track(watchPaths([{ path: dir, recursive: true }], () => calls++, { debounceMs: 100 }));
  expect(handle.mode()).toBe("watch");
  await wait(SETTLE_MS);
  calls = 0;
  for (let i = 0; i < 5; i++) writeFileSync(join(dir, "src", `f${i}.ts`), "x");
  await waitFor(() => calls > 0);
  await wait(400);
  expect(calls).toBe(1);
  handle.close();
  writeFileSync(join(dir, "src", "after.ts"), "x");
  await wait(300);
  expect(calls).toBe(1);
});

test("changes inside .git internals and .kibo/worktrees are ignored, HEAD is not", async () => {
  mkdirSync(join(dir, ".git", "objects", "ab"), { recursive: true });
  mkdirSync(join(dir, ".kibo", "worktrees", "kib-1"), { recursive: true });
  let calls = 0;
  track(watchPaths([{ path: dir, recursive: true }], () => calls++, { debounceMs: 50 }));
  await wait(SETTLE_MS);
  calls = 0;
  writeFileSync(join(dir, ".git", "objects", "ab", "cdef"), "x");
  writeFileSync(join(dir, ".kibo", "worktrees", "kib-1", "a.ts"), "x");
  await wait(400);
  expect(calls).toBe(0);
  writeFileSync(join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
  await waitFor(() => calls === 1);
});

test("an unwatchable path falls back to polling and reports the error", async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const handle = track(
    watchPaths([{ path: join(dir, "missing"), recursive: true }], () => calls++, {
      pollMs: 30,
      onError: (e) => errors.push(e),
    }),
  );
  expect(handle.mode()).toBe("poll");
  expect(errors).toHaveLength(1);
  await waitFor(() => calls > 1);
  handle.close();
  const after = calls;
  await wait(100);
  expect(calls).toBe(after);
});

test("a descriptor limit while opening closes the opened watchers and polls", () => {
  const { watch, watchers } = fakeWatch(1);
  const errors: unknown[] = [];
  const handle = track(
    watchPaths(
      [
        { path: "/a", recursive: true },
        { path: "/b", recursive: true },
      ],
      () => {},
      { pollMs: 1000, onError: (e) => errors.push(e), watch },
    ),
  );
  expect(handle.mode()).toBe("poll");
  expect(errors).toEqual([expect.objectContaining({ code: "EMFILE" })]);
  expect(watchers.map((w) => w.closed)).toEqual([true]);
});

test("a watcher error at runtime switches every target to polling", async () => {
  const { watch, watchers } = fakeWatch();
  const errors: unknown[] = [];
  let calls = 0;
  const handle = track(
    watchPaths(
      [
        { path: "/a", recursive: true },
        { path: "/b", recursive: false },
      ],
      () => calls++,
      { pollMs: 20, onError: (e) => errors.push(e), watch },
    ),
  );
  expect(handle.mode()).toBe("watch");
  const failure = Object.assign(new Error("inotify limit"), { code: "ENOSPC" });
  watchers[0]?.fail(failure);
  watchers[1]?.fail(failure);
  expect(handle.mode()).toBe("poll");
  expect(errors).toEqual([failure, failure]);
  expect(watchers.map((w) => w.closed)).toEqual([true, true]);
  await waitFor(() => calls > 1);
});

test("close stops pending debounce and ignores later events", async () => {
  const { watch, watchers } = fakeWatch();
  let calls = 0;
  const errors: unknown[] = [];
  const handle = watchPaths([{ path: "/a", recursive: true }], () => calls++, {
    debounceMs: 20,
    pollMs: 10,
    onError: (e) => errors.push(e),
    watch,
  });
  watchers[0]?.emit("src/a.ts");
  handle.close();
  handle.close();
  watchers[0]?.emit("src/b.ts");
  const late = new Error("late");
  watchers[0]?.fail(late);
  await wait(80);
  expect(calls).toBe(0);
  expect(watchers.map((w) => w.closed)).toEqual([true]);
  expect(errors).toEqual([late]);
  expect(handle.mode()).not.toBe("poll");
});

test("the change names the paths relative to the root, or none when it cannot", async () => {
  const { watch, watchers } = fakeWatch();
  const changes: (string[] | null)[] = [];
  track(
    watchPaths(
      [
        { path: "/repo", recursive: true },
        { path: "/common/.git", recursive: true },
      ],
      (paths) => changes.push(paths),
      { debounceMs: 10, root: "/repo", watch },
    ),
  );
  const [tree, common] = watchers;
  tree?.emit("src/a.ts");
  tree?.emit("src/b.ts");
  tree?.emit("src/a.ts");
  await waitFor(() => changes.length === 1);
  tree?.emit(".git/HEAD");
  tree?.emit("src/c.ts");
  await waitFor(() => changes.length === 2);
  common?.emit("refs/heads/main");
  await waitFor(() => changes.length === 3);
  tree?.emit(null);
  await waitFor(() => changes.length === 4);
  for (let i = 0; i <= MAX_EVENT_PATHS; i++) tree?.emit(`f${i}.ts`);
  await waitFor(() => changes.length === 5);
  expect(changes).toEqual([["src/a.ts", "src/b.ts"], null, null, null, null]);
});

test("targets covered by a recursive parent are dropped", () => {
  expect(
    dedupeTargets([
      { path: "/repo", recursive: true },
      { path: "/repo/.git", recursive: false },
      { path: "/repo/.git/worktrees/kib", recursive: false },
      { path: "/elsewhere/.git", recursive: true },
      { path: "/repo-evil", recursive: false },
      { path: "/elsewhere/.git", recursive: true },
      { path: "/solo", recursive: false },
      { path: "/solo", recursive: true },
    ]),
  ).toEqual([
    { path: "/repo", recursive: true },
    { path: "/elsewhere/.git", recursive: true },
    { path: "/repo-evil", recursive: false },
    { path: "/solo", recursive: true },
  ]);
});

test("only git state files count inside a git dir", () => {
  expect(isRelevantChange("/repo", "src/a.ts")).toBe(true);
  expect(isRelevantChange("/repo", null)).toBe(true);
  expect(isRelevantChange("/repo", ".git/HEAD")).toBe(true);
  expect(isRelevantChange("/repo", ".git/index")).toBe(true);
  expect(isRelevantChange("/repo", ".git/refs/heads/main")).toBe(true);
  expect(isRelevantChange("/repo", ".git/packed-refs")).toBe(true);
  expect(isRelevantChange("/repo", ".git/rebase-merge/done")).toBe(true);
  expect(isRelevantChange("/repo", ".git/MERGE_HEAD")).toBe(true);
  expect(isRelevantChange("/repo", ".git/objects/ab/cdef")).toBe(false);
  expect(isRelevantChange("/repo", ".git/logs/HEAD")).toBe(false);
  expect(isRelevantChange("/repo", ".git/index.lock")).toBe(false);
  expect(isRelevantChange("/repo", ".git")).toBe(false);
  expect(isRelevantChange("/repo/.git", "refs/remotes/origin/main")).toBe(true);
  expect(isRelevantChange("/repo/.git", "worktrees/kib/HEAD")).toBe(true);
  expect(isRelevantChange("/repo/.git", "worktrees/kib/logs/HEAD")).toBe(false);
  expect(isRelevantChange("/repo/.git/worktrees/kib", "index")).toBe(true);
  expect(isRelevantChange("/repo/.git/worktrees/kib", "ORIG_HEAD")).toBe(false);
  expect(isRelevantChange("/repo", ".kibo/worktrees/kib/src/a.ts")).toBe(false);
  expect(isRelevantChange("/repo", ".kibo/config.json")).toBe(true);
  expect(isRelevantChange("/repo/.kibo/worktrees/kib", "src/a.ts")).toBe(true);
  expect(isRelevantChange("/repo", "src\\.git\\objects\\x")).toBe(false);
  expect(isRelevantChange("/repo", ".github/workflows/ci.yml")).toBe(true);
});
