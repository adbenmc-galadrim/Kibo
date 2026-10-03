import { Database } from "bun:sqlite";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { dirname } from "node:path";
import { KiboError } from "@kibo/schema";

export type ServerDb = { db: Database; close(): void };

const SQLITE_BUSY_TIMEOUT_MS = 5_000;

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL, disabledAt INTEGER)",
  "CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), publicKey TEXT NOT NULL UNIQUE, name TEXT NOT NULL, createdAt INTEGER NOT NULL, lastSeenAt INTEGER, revokedAt INTEGER)",
  "CREATE INDEX IF NOT EXISTS devices_by_user ON devices(userId)",
  "CREATE TABLE IF NOT EXISTS invites (codeHash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('account', 'device', 'project')), name TEXT, userId TEXT, projectId TEXT, role TEXT CHECK (role IS NULL OR role IN ('editor', 'viewer')), createdBy TEXT NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, usedAt INTEGER)",
  "CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, createdAt INTEGER NOT NULL, ticketSeq INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS members (projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, userId TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')), addedAt INTEGER NOT NULL, PRIMARY KEY (projectId, userId))",
  "CREATE INDEX IF NOT EXISTS members_by_user ON members(userId)",
  "CREATE TABLE IF NOT EXISTS updates (projectId TEXT NOT NULL, seq INTEGER NOT NULL, bytes BLOB NOT NULL, userId TEXT NOT NULL, deviceId TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (projectId, seq))",
  "CREATE TABLE IF NOT EXISTS snapshots (projectId TEXT NOT NULL, bytes BLOB NOT NULL, versionJson TEXT NOT NULL, uptoSeq INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (projectId, uptoSeq))",
  "CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, userId TEXT, deviceId TEXT, projectId TEXT, detail TEXT)",
  "CREATE INDEX IF NOT EXISTS audit_by_at ON audit(at)",
  "CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END",
  "CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END",
];

function prepareFile(file: string): void {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  if (!existsSync(file)) closeSync(openSync(file, "a", 0o600));
}

function restrictFiles(file: string): void {
  for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) chmodSync(f, 0o600);
}

export function openServerDb(file: string): ServerDb {
  const onDisk = file !== ":memory:";
  if (onDisk) prepareFile(file);
  let db: Database;
  try {
    db = new Database(file, { create: true, strict: true });
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = FULL");
    db.exec("PRAGMA foreign_keys = ON");
    for (const statement of SCHEMA) db.exec(statement);
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot open sync database ${file}: ${String(e)}`);
  }
  if (onDisk) restrictFiles(file);
  return { db, close: () => db.close() };
}

export function immediateTransaction<A extends unknown[], R>(
  db: Database,
  fn: (...args: A) => R,
): (...args: A) => R {
  const tx = db.transaction(fn);
  return (...args) => tx.immediate(...args);
}
