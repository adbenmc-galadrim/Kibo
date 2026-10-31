import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BACKUP_TICK_MS, type ChangeMessage } from "@kibo/schema";
import { appVersion } from "./app-version";
import { loadOrCreateToken } from "./auth";
import { startBackupSchedule } from "./backups/schedule";
import { type BackupsService, createBackupsService } from "./backups/service";
import type { Closer } from "./daemon-shutdown";
import { createRedactor, type Redactor } from "./integrations/redact";
import { runLegacyMigrations } from "./migrations/legacy";
import { LEGACY_DATABASES } from "./migrations/legacy-backup";
import { markSecretsPruned } from "./migrations/legacy-secrets";
import { openRunStore, type RunStore } from "./runs/run-store";
import { openLocalSettings } from "./settings";
import { openStore, type Store } from "./store";

type DaemonStores = { store: Store; runs: RunStore; token: string; redactor: Redactor };
type LocalServices = {
  backups: BackupsService;
  scheduleBackups(): Closer;
};

export function openDaemonStores(
  opts: { home: string; redactor?: Redactor },
  closers: Closer[],
): DaemonStores {
  const fresh = !LEGACY_DATABASES.some((file) => existsSync(join(opts.home, file)));
  runLegacyMigrations(opts.home, Date.now, (line) => console.error(`[kibo-daemon] ${line}`));
  const store = openStore(opts.home);
  closers.push(() => store.close());
  const runs = openRunStore(opts.home);
  closers.push(() => runs.close());
  if (fresh) markSecretsPruned(runs, Date.now);
  const token = loadOrCreateToken(opts.home);
  const redactor = opts.redactor ?? createRedactor();
  redactor.add(token);
  return { store, runs, token, redactor };
}

export function createLocalServices(
  opts: { home: string; userHome?: string },
  { store, runs }: Pick<DaemonStores, "store" | "runs">,
  emit: (message: ChangeMessage) => void,
): LocalServices {
  const backups = createBackupsService({
    home: opts.home,
    userHome: opts.userHome ?? homedir(),
    settings: openLocalSettings(store),
    databases: [
      { file: "kibo.db", vacuumInto: store.vacuumInto },
      { file: "runs.db", vacuumInto: runs.vacuumInto },
    ],
    appVersion: appVersion(),
    emit,
  });
  const scheduleBackups = () =>
    startBackupSchedule(backups, {
      intervalMs: BACKUP_TICK_MS,
      log: (message, error) => console.error(`[kibo-daemon] ${message}`, error),
    });
  return { backups, scheduleBackups };
}
