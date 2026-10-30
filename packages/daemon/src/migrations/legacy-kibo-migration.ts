import type { Database } from "bun:sqlite";
import { immediateTransaction } from "../sqlite-busy";
import { dropTables, tableExists } from "./legacy-sqlite";

export const LEGACY_KIBO_MARKER = "legacy_tables_dropped_at";
export const DROPPED_KIBO_TABLES: readonly string[] = [
  "agent_settings",
  "file_versions",
  "component_drafts",
  "market_sources",
  "market_pins",
  "market_index_cache",
  "sync_items",
  "sync_cursors",
  "sync_outbox",
  "sync_config",
  "sync_projects",
];

type LegacyKiboResult = { droppedTables: string[]; removedRemoteSessions: number };

function ensureMarkerTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS local_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  );
}

function hasMarker(db: Database): boolean {
  return (
    db.query("SELECT 1 AS found FROM local_state WHERE key = $key").get({ key: LEGACY_KIBO_MARKER }) !== null
  );
}

function removeRemoteSessions(db: Database): number {
  if (!tableExists(db, "remote_sessions")) return 0;
  return db.query("DELETE FROM remote_sessions WHERE remote = 1").run().changes;
}

export function migrateLegacyKibo(
  db: Database,
  now: () => number,
  tables: readonly string[] = DROPPED_KIBO_TABLES,
): LegacyKiboResult | null {
  ensureMarkerTable(db);
  return immediateTransaction(db, (): LegacyKiboResult | null => {
    if (hasMarker(db)) return null;
    const removedRemoteSessions = removeRemoteSessions(db);
    const droppedTables = dropTables(db, tables);
    const at = now();
    db.query("INSERT INTO local_state (key, value, updated_at) VALUES ($key, $value, $at)").run({
      key: LEGACY_KIBO_MARKER,
      value: String(at),
      at,
    });
    return { droppedTables, removedRemoteSessions };
  })();
}
