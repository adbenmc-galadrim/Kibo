import { homedir } from "node:os";
import { osSandbox } from "@kibo/devkit";
import { BACKUP_TICK_MS, type ChangeMessage } from "@kibo/schema";
import { appVersion } from "./app-version";
import { loadOrCreateToken } from "./auth";
import { startBackupSchedule } from "./backups/schedule";
import { type BackupsService, createBackupsService } from "./backups/service";
import type { Closer } from "./daemon-shutdown";
import { createRedactor, type Redactor } from "./integrations/redact";
import { runLegacyMigrations } from "./migrations/legacy";
import { openRunStore, type RunStore } from "./runs/run-store";
import { createSandboxService, type SandboxService } from "./sandbox/sandbox-service";
import { openLocalSettings } from "./settings";
import { openStore, type Store } from "./store";

export type DaemonStores = { store: Store; runs: RunStore; token: string; redactor: Redactor };
export type LocalServices = {
  sandbox: SandboxService;
  backups: BackupsService;
  scheduleBackups(): Closer;
};

export function openDaemonStores(
  opts: { home: string; redactor?: Redactor },
  closers: Closer[],
): DaemonStores {
  runLegacyMigrations(opts.home, Date.now, (line) => console.error(`[kibo-daemon] ${line}`));
  const store = openStore(opts.home);
  closers.push(() => store.close());
  const runs = openRunStore(opts.home);
  closers.push(() => runs.close());
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
  const sandbox = createSandboxService({ sandbox: osSandbox(), settings: openLocalSettings(store), emit });
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
  return { sandbox, backups, scheduleBackups };
}
