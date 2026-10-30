import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BackupInfo, KiboError } from "@kibo/schema";
import { appVersion } from "../app-version";
import { backupIdAt } from "../backups/backup-id";
import { SQLITE_BUSY_TIMEOUT_MS } from "../sqlite-busy";

export type LegacyBackup = { dir: string; files: string[] };

export const LEGACY_DATABASES = ["kibo.db", "runs.db"] as const;
const SUFFIX = "-avant-retrait";
const PARTIAL = ".partial";

function vacuumInto(file: string, target: string): void {
  const db = new Database(file, { strict: true });
  try {
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    db.run("VACUUM INTO ?", [target]);
  } finally {
    db.close();
  }
}

function fill(home: string, staging: string, files: string[], id: string, at: Date): void {
  mkdirSync(staging, { recursive: true, mode: 0o700 });
  let bytes = 0;
  for (const file of files) {
    const target = join(staging, file);
    vacuumInto(join(home, file), target);
    chmodSync(target, 0o600);
    bytes += statSync(target).size;
  }
  const manifest: BackupInfo & { entries: string[] } = {
    id,
    createdAt: at.getTime(),
    reason: "migration",
    bytes,
    appVersion: appVersion(),
    entries: files,
  };
  writeFileSync(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
}

export function backupBeforeMigration(home: string, now: () => Date): LegacyBackup {
  const at = now();
  const id = `${backupIdAt(at.getTime())}${SUFFIX}`;
  const dir = join(home, "backups", id);
  const staging = `${dir}${PARTIAL}`;
  const files = LEGACY_DATABASES.filter((file) => existsSync(join(home, file)));
  try {
    if (existsSync(dir)) throw new Error(`${dir} already exists`);
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    fill(home, staging, files, id, at);
    renameSync(staging, dir);
    return { dir, files };
  } catch (e) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    throw new KiboError("BACKUP_FAILED", `cannot save the databases before the migration: ${String(e)}`);
  }
}
