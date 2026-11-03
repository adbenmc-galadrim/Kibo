import { Database } from "bun:sqlite";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS account (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    account_id TEXT NOT NULL,
    mac_token_hash BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS passkeys (
    credential_id TEXT PRIMARY KEY,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS phone_sessions (
    token_hash BLOB PRIMARY KEY,
    created_at INTEGER NOT NULL,
    renewed_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pair_tokens (
    token_hash BLOB PRIMARY KEY,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS webauthn_challenges (
    challenge TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    seq INTEGER NOT NULL,
    header TEXT NOT NULL,
    nonce BLOB NOT NULL,
    ciphertext BLOB NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (project_id, kind)
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    scope TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    window_start INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mac_presence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    online INTEGER NOT NULL,
    last_seen_at INTEGER
  )`,
];

export function openDb(path: string): Database {
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  for (const statement of SCHEMA) db.run(statement);
  return db;
}
