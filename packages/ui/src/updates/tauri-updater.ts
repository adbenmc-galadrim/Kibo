import { KiboError } from "@kibo/schema";
import type { Update } from "@tauri-apps/plugin-updater";
import type { UpdateInfo } from "./update-state";
import type { UpdaterPort } from "./update-store";

const toUpdateInfo = (update: Update): UpdateInfo => ({
  version: update.version,
  currentVersion: update.currentVersion,
  notes: update.body ?? null,
  publishedAt: update.date ?? null,
});

export function createTauriUpdaterPort(backup: () => Promise<void>): UpdaterPort {
  let pending: Update | null = null;
  return {
    backup,
    async installedVersion() {
      const { getVersion } = await import("@tauri-apps/api/app");
      return getVersion();
    },
    async check() {
      const { check } = await import("@tauri-apps/plugin-updater");
      await pending?.close();
      pending = await check();
      return pending ? toUpdateInfo(pending) : null;
    },
    async downloadAndInstall(onEvent) {
      if (!pending) throw new KiboError("NOT_FOUND", "no update was found before installing");
      await pending.downloadAndInstall(onEvent);
    },
    async relaunch() {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}
