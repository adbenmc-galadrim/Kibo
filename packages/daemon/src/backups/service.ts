import { mkdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  BACKUP_EVERY_MS,
  BACKUP_SETTINGS_DEFAULT,
  type BackupInfo,
  type BackupReason,
  BackupSettings,
  type BackupStatus,
  KiboError,
  type Phase7Event,
} from "@kibo/schema";
import type { LocalSettings } from "../settings";
import { type BackupDatabase, readBackups, removeBackupDir, writeBackup } from "./backup-fs";
import { backupIdAt } from "./backup-id";
import { toRotate } from "./rotate";
import { isBackupDue } from "./schedule";

export type BackupsService = {
  status(): Promise<BackupStatus>;
  list(): Promise<BackupInfo[]>;
  create(reason: BackupReason): Promise<BackupInfo>;
  remove(id: string): Promise<void>;
  setSettings(patch: { enabled?: boolean; dir?: string | null }): Promise<BackupStatus>;
  tick(): Promise<void>;
};

export type BackupsDeps = {
  home: string;
  userHome: string;
  settings: LocalSettings;
  databases: BackupDatabase[];
  appVersion: string;
  now?: () => number;
  emit(event: Phase7Event): void;
};

const SETTINGS_KEY = "backups";

function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function displayPath(path: string, userHome: string): string {
  if (!isInside(path, userHome)) return path;
  const rel = relative(userHome, path);
  return rel === "" ? "~" : `~/${rel}`;
}

async function resolveDir(dir: string, home: string): Promise<string> {
  if (!isAbsolute(dir)) throw new KiboError("INVALID_INPUT", "the backup folder must be an absolute path");
  let resolved: string;
  try {
    resolved = await realpath(dir);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `the backup folder does not exist: ${String(e)}`);
  }
  if (!(await stat(resolved)).isDirectory())
    throw new KiboError("INVALID_INPUT", "the backup folder is not a folder");
  const realHome = await realpath(home);
  if (isInside(resolved, realHome) || isInside(realHome, resolved))
    throw new KiboError("INVALID_INPUT", "the backup folder cannot be inside the Kibo folder or contain it");
  return resolved;
}

export function createBackupsService(deps: BackupsDeps): BackupsService {
  const now = deps.now ?? Date.now;
  let running = false;
  const settings = () => deps.settings.get(SETTINGS_KEY, BackupSettings, BACKUP_SETTINGS_DEFAULT);
  const dirOf = (s: BackupSettings) => s.dir ?? join(deps.home, "backups");
  const changed = () => deps.emit({ type: "backups.changed" });

  const list = () => readBackups(dirOf(settings()));

  const status = async (): Promise<BackupStatus> => {
    const s = settings();
    const dir = dirOf(s);
    const last = (await readBackups(dir)).at(-1) ?? null;
    const nextAt = s.enabled ? (last ? last.createdAt + BACKUP_EVERY_MS : now()) : null;
    return { settings: s, dir, displayDir: displayPath(dir, deps.userHome), last, nextAt, running };
  };

  const rotate = async (dest: string) => {
    for (const old of toRotate(await readBackups(dest))) await removeBackupDir(dest, old.id);
  };

  const create = async (reason: BackupReason): Promise<BackupInfo> => {
    if (running) throw new KiboError("CONFLICT", "a backup is already running");
    running = true;
    const at = now();
    changed();
    try {
      const dest = dirOf(settings());
      await mkdir(dest, { recursive: true, mode: 0o700 });
      const info = await writeBackup({
        home: deps.home,
        dest,
        id: backupIdAt(at),
        reason,
        appVersion: deps.appVersion,
        now: at,
        databases: deps.databases,
      });
      if (reason === "auto") await rotate(dest);
      return info;
    } finally {
      running = false;
      changed();
    }
  };

  return {
    status,
    list,
    create,
    async remove(id) {
      await removeBackupDir(dirOf(settings()), id);
      changed();
    },
    async setSettings(patch) {
      const current = settings();
      const dir =
        patch.dir === undefined
          ? current.dir
          : patch.dir === null
            ? null
            : await resolveDir(patch.dir, deps.home);
      deps.settings.set(SETTINGS_KEY, { enabled: patch.enabled ?? current.enabled, dir });
      changed();
      return status();
    },
    async tick() {
      const s = settings();
      if (!s.enabled || running) return;
      const last = (await readBackups(dirOf(s))).at(-1) ?? null;
      if (isBackupDue(last?.createdAt ?? null, now())) await create("auto");
    },
  };
}
