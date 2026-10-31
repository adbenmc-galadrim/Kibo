import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { SQLITE_BUSY_TIMEOUT_MS } from "../sqlite-busy";
import { backupBeforeMigration, LEGACY_DATABASES } from "./legacy-backup";
import { LEGACY_KIBO_MARKER, migrateLegacyKibo } from "./legacy-kibo-migration";
import { LEGACY_RUNS_MARKER, migrateLegacyRuns, removeLegacyRunDirs } from "./legacy-runs-migration";
import { tableExists, vacuumDatabase } from "./legacy-sqlite";

function openDatabase(home: string, file: string): Database {
  const db = new Database(join(home, file), { create: true, strict: true });
  db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  return db;
}

function hasMarker(db: Database, table: string, key: string): boolean {
  return (
    tableExists(db, table) &&
    db.query(`SELECT 1 AS found FROM ${table} WHERE key = $key`).get({ key }) !== null
  );
}

function pending(home: string): boolean {
  const kibo = openDatabase(home, "kibo.db");
  const runs = openDatabase(home, "runs.db");
  try {
    return (
      !hasMarker(kibo, "local_state", LEGACY_KIBO_MARKER) ||
      !hasMarker(runs, "host_settings", LEGACY_RUNS_MARKER)
    );
  } finally {
    runs.close();
    kibo.close();
  }
}

type Log = (line: string) => void;
type Vacuum = (file: string) => void;

function migrateRuns(home: string, now: () => number, log: Log): boolean {
  const runs = openDatabase(home, "runs.db");
  try {
    const result = migrateLegacyRuns(runs, now);
    if (!result) return false;
    removeLegacyRunDirs(home, result.removedRunIds);
    log(
      `legacy migration: ${result.removedRuns} ticket runs removed, ${result.droppedTables.length} tables dropped from runs.db`,
    );
    return result.removedRuns > 0 || result.droppedTables.length > 0;
  } finally {
    runs.close();
  }
}

function migrateKibo(home: string, now: () => number, log: Log): boolean {
  const kibo = openDatabase(home, "kibo.db");
  try {
    const result = migrateLegacyKibo(kibo, now);
    if (!result) return false;
    log(
      `legacy migration: ${result.removedRemoteSessions} remote sessions removed, ${result.droppedTables.length} tables dropped from kibo.db`,
    );
    return result.removedRemoteSessions > 0 || result.droppedTables.length > 0;
  } finally {
    kibo.close();
  }
}

function compact(home: string, file: string, vacuum: Vacuum, log: Log): void {
  try {
    vacuum(join(home, file));
  } catch (e) {
    const error = new KiboError("VACUUM_FAILED", `cannot compact ${file}: ${String(e)}`);
    log(`legacy migration: ${error.code} ${error.message}`);
  }
}

function migrate(home: string, now: () => number, log: Log, vacuum: Vacuum): void {
  if (migrateRuns(home, now, log)) compact(home, "runs.db", vacuum, log);
  if (migrateKibo(home, now, log)) compact(home, "kibo.db", vacuum, log);
}

export function runLegacyMigrations(
  home: string,
  now: () => number,
  log: Log,
  vacuum: Vacuum = vacuumDatabase,
): void {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const existed = LEGACY_DATABASES.some((file) => existsSync(join(home, file)));
  if (!pending(home)) return;
  if (existed) {
    try {
      const backup = backupBeforeMigration(home, () => new Date(now()));
      log(`legacy migration: databases saved in ${backup.dir}`);
    } catch (e) {
      if (!(e instanceof KiboError) || e.code !== "BACKUP_FAILED") throw e;
      log(`legacy migration skipped: ${e.code} ${e.message}`);
      return;
    }
  }
  migrate(home, now, log, vacuum);
}
