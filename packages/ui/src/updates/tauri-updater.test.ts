import { describe, expect, mock, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import type { DownloadEvent } from "./update-store";

const calls: string[] = [];
let found: Record<string, unknown> | null = {
  version: "1.1.0",
  currentVersion: "1.0.0",
  body: "Notes",
  date: "2026-09-27T10:00:00Z",
  downloadAndInstall: (onEvent?: (e: DownloadEvent) => void) => {
    calls.push("downloadAndInstall");
    onEvent?.({ event: "Finished" });
    return Promise.resolve();
  },
  close: () => {
    calls.push("close");
    return Promise.resolve();
  },
};

mock.module("@tauri-apps/plugin-updater", () => ({
  check: () => {
    calls.push("check");
    return Promise.resolve(found);
  },
}));
mock.module("@tauri-apps/plugin-process", () => ({
  relaunch: () => {
    calls.push("relaunch");
    return Promise.resolve();
  },
}));
mock.module("@tauri-apps/api/app", () => ({ getVersion: () => Promise.resolve("1.0.0") }));

const { createTauriUpdaterPort } = await import("./tauri-updater");

describe("tauri updater port", () => {
  test("maps the plugin update to the store's update info", async () => {
    const port = createTauriUpdaterPort(async () => {});
    expect(await port.installedVersion()).toBe("1.0.0");
    expect(await port.check()).toEqual({
      version: "1.1.0",
      currentVersion: "1.0.0",
      notes: "Notes",
      publishedAt: "2026-09-27T10:00:00Z",
    });
    const events: DownloadEvent[] = [];
    await port.downloadAndInstall((e) => events.push(e));
    expect(events).toEqual([{ event: "Finished" }]);
    await port.relaunch();
    expect(calls).toEqual(["check", "downloadAndInstall", "relaunch"]);
  });

  test("a new check releases the previous update, and nothing installs without one", async () => {
    calls.length = 0;
    const port = createTauriUpdaterPort(async () => {});
    await port.check();
    found = null;
    expect(await port.check()).toBeNull();
    expect(calls).toEqual(["check", "close", "check"]);
    await expect(port.downloadAndInstall(() => {})).rejects.toBeInstanceOf(KiboError);
  });

  test("the backup before an update is the one given by the daemon side", async () => {
    const backups: string[] = [];
    const port = createTauriUpdaterPort(async () => {
      backups.push("update");
    });
    await port.backup();
    expect(backups).toEqual(["update"]);
  });
});
