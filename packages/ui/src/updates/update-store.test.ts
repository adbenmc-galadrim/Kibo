import { describe, expect, test } from "bun:test";
import type { UpdateInfo } from "./update-state";
import { createUpdateStore, type DownloadEvent, type UpdaterPort } from "./update-store";

const update: UpdateInfo = { version: "1.1.0", currentVersion: "1.0.0", notes: null, publishedAt: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakePort(overrides: Partial<UpdaterPort> = {}) {
  const calls: string[] = [];
  let onEvent: ((e: DownloadEvent) => void) | null = null;
  const port: UpdaterPort = {
    installedVersion: () => Promise.resolve("1.0.0"),
    check: () => {
      calls.push("check");
      return Promise.resolve(update);
    },
    backup: () => {
      calls.push("backup");
      return Promise.resolve();
    },
    downloadAndInstall: (report) => {
      calls.push("install");
      onEvent = report;
      return Promise.resolve();
    },
    relaunch: () => {
      calls.push("relaunch");
      return Promise.resolve();
    },
    ...overrides,
  };
  return { port, calls, emit: (e: DownloadEvent) => onEvent?.(e) };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("update store", () => {
  test("loads the installed version once and notifies subscribers", async () => {
    let asked = 0;
    const { port } = fakePort({
      installedVersion: () => {
        asked++;
        return Promise.resolve("1.0.0");
      },
    });
    const store = createUpdateStore(port);
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.snapshot().installed ?? "?"));
    expect(store.snapshot().installed).toBeNull();
    await store.loadInstalled();
    await store.loadInstalled();
    expect(asked).toBe(1);
    expect(seen).toEqual(["1.0.0"]);
  });

  test("a check goes through checking to available", async () => {
    const { port, calls } = fakePort();
    const store = createUpdateStore(port);
    const phases: string[] = [];
    store.subscribe(() => phases.push(store.snapshot().status.phase));
    await store.check();
    expect(phases).toEqual(["checking", "available"]);
    expect(store.snapshot().status).toEqual({ phase: "available", update });
    expect(calls).toEqual(["check"]);
  });

  test("a check without update records the time, a failing check records the reason", async () => {
    const none = createUpdateStore(fakePort({ check: () => Promise.resolve(null) }).port, () => 7);
    await none.check();
    expect(none.snapshot().status).toEqual({ phase: "current", checkedAt: 7 });
    const failing = createUpdateStore(fakePort({ check: () => Promise.reject(new Error("offline")) }).port);
    await failing.check();
    expect(failing.snapshot().status).toEqual({
      phase: "error",
      step: "check",
      detail: "offline",
      update: null,
    });
  });

  test("concurrent checks run once", async () => {
    const pending = deferred<UpdateInfo | null>();
    let started = 0;
    const { port } = fakePort({
      check: () => {
        started++;
        return pending.promise;
      },
    });
    const store = createUpdateStore(port);
    const first = store.check();
    const second = store.check();
    pending.resolve(null);
    await Promise.all([first, second]);
    expect(started).toBe(1);
    expect(store.snapshot().status.phase).toBe("current");
  });

  test("an install reports the download, then installs and relaunches", async () => {
    const done = deferred<void>();
    const { port, calls, emit } = fakePort();
    port.downloadAndInstall = (report) => {
      calls.push("install");
      report({ event: "Started", data: { contentLength: 100 } });
      report({ event: "Progress", data: { chunkLength: 60 } });
      return done.promise;
    };
    const store = createUpdateStore(port);
    await store.check();
    const installing = store.install();
    await settle();
    expect(store.snapshot().status).toEqual({ phase: "downloading", update, received: 60, total: 100 });
    emit({ event: "Finished" });
    done.resolve();
    await installing;
    expect(store.snapshot().status).toEqual({ phase: "installing", update });
    expect(calls).toEqual(["check", "backup", "install", "relaunch"]);
  });

  test("a failed install keeps the update and never relaunches", async () => {
    const { port, calls } = fakePort({ downloadAndInstall: () => Promise.reject(new Error("disk full")) });
    const store = createUpdateStore(port);
    await store.check();
    await store.install();
    expect(store.snapshot().status).toEqual({ phase: "error", step: "install", detail: "disk full", update });
    expect(calls).not.toContain("relaunch");
  });

  test("install backs up first, then downloads; a failed backup blocks the install with a backup error", async () => {
    const order: string[] = [];
    const backup = deferred<void>();
    const { port } = fakePort({
      backup: () => {
        order.push("backup");
        return backup.promise;
      },
      downloadAndInstall: async () => {
        order.push("download");
      },
    });
    const store = createUpdateStore(port);
    await store.check();
    const installing = store.install();
    await settle();
    expect(store.snapshot().status).toEqual({ phase: "backingUp", update });
    backup.resolve();
    await installing;
    expect(order).toEqual(["backup", "download"]);
    const failing = fakePort({ backup: () => Promise.reject(new Error("CONFLICT: a backup is running")) });
    const refused = createUpdateStore(failing.port);
    await refused.check();
    await refused.install();
    expect(refused.snapshot().status).toMatchObject({ phase: "error", step: "backup", update });
    expect(failing.calls).toEqual(["check"]);
  });

  test("install does nothing without an available update", async () => {
    const { port, calls } = fakePort();
    const store = createUpdateStore(port);
    await store.install();
    expect(calls).toEqual([]);
  });
});
