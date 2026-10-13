import type { Database } from "bun:sqlite";
import { KiboError } from "@kibo/schema";
import { openRunsDatabase } from "../skills/runs-db";

const FROZEN_OVERLAP_COLUMNS =
  "id, project_id, kind, key, owner_run_id, other_run_id, owner_workspace, other_workspace, detail, first_seen_at";
const FROZEN_IGNORE_COLUMNS = "id, project_id, kind, key, label, by, at";
const APPEND_ONLY = ["run_overlap_events", "run_auto_links", "run_auto_link_events"];
const NO_DELETE = ["run_overlaps", "run_overlap_ignores"];
const abort = "BEGIN SELECT RAISE(ABORT, 'append-only'); END";

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS run_overlaps (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, " +
    "key TEXT NOT NULL, owner_run_id TEXT NOT NULL, other_run_id TEXT NOT NULL, owner_workspace TEXT NOT NULL, " +
    "other_workspace TEXT NOT NULL, detail TEXT NOT NULL, first_seen_at INTEGER NOT NULL, " +
    "last_seen_at INTEGER NOT NULL, open INTEGER NOT NULL DEFAULT 1)",
  "CREATE UNIQUE INDEX IF NOT EXISTS run_overlaps_open_pair ON run_overlaps " +
    "(project_id, kind, key, owner_workspace, other_workspace) WHERE open = 1",
  "CREATE INDEX IF NOT EXISTS run_overlaps_by_project ON run_overlaps (project_id, open)",
  "CREATE INDEX IF NOT EXISTS run_overlaps_by_owner ON run_overlaps (owner_run_id)",
  "CREATE INDEX IF NOT EXISTS run_overlaps_by_other ON run_overlaps (other_run_id)",
  "CREATE TABLE IF NOT EXISTS run_overlap_events (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "overlap_id TEXT NOT NULL REFERENCES run_overlaps(id), type TEXT NOT NULL, role TEXT, by TEXT, at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS run_overlap_events_by_overlap ON run_overlap_events (overlap_id, at, id)",
  "CREATE TABLE IF NOT EXISTS run_overlap_ignores (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, " +
    "kind TEXT NOT NULL, key TEXT NOT NULL, label TEXT NOT NULL, by TEXT NOT NULL, at INTEGER NOT NULL, " +
    "active INTEGER NOT NULL DEFAULT 1)",
  "CREATE INDEX IF NOT EXISTS run_overlap_ignores_by_project ON run_overlap_ignores (project_id, active)",
  "CREATE TABLE IF NOT EXISTS run_auto_links (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, link_id TEXT NOT NULL, " +
    "from_ticket_id TEXT NOT NULL, to_ticket_id TEXT NOT NULL, from_ticket_key TEXT NOT NULL, " +
    "to_ticket_key TEXT NOT NULL, owner_run_id TEXT NOT NULL, other_run_id TEXT NOT NULL, reason TEXT NOT NULL, " +
    "path TEXT NOT NULL, name TEXT, at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS run_auto_links_by_project ON run_auto_links (project_id, from_ticket_id, to_ticket_id)",
  "CREATE TABLE IF NOT EXISTS run_auto_link_events (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "auto_link_id TEXT NOT NULL REFERENCES run_auto_links(id), type TEXT NOT NULL, by TEXT, at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS run_auto_link_events_by_link ON run_auto_link_events (auto_link_id, at, id)",
  `CREATE TRIGGER IF NOT EXISTS run_overlaps_frozen BEFORE UPDATE OF ${FROZEN_OVERLAP_COLUMNS} ON run_overlaps ${abort}`,
  "CREATE TRIGGER IF NOT EXISTS run_overlaps_never_reopen BEFORE UPDATE OF open ON run_overlaps " +
    `WHEN NEW.open > OLD.open ${abort}`,
  "CREATE TRIGGER IF NOT EXISTS run_overlap_ignores_never_reactivated BEFORE UPDATE OF active ON run_overlap_ignores " +
    `WHEN NEW.active > OLD.active ${abort}`,
  `CREATE TRIGGER IF NOT EXISTS run_overlap_ignores_frozen BEFORE UPDATE OF ${FROZEN_IGNORE_COLUMNS} ON run_overlap_ignores ${abort}`,
  ...NO_DELETE.map((t) => `CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t} ${abort}`),
  ...APPEND_ONLY.flatMap((t) => [
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_update BEFORE UPDATE ON ${t} ${abort}`,
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t} ${abort}`,
  ]),
];

export function openOverlapDatabase(home: string): Database {
  const db = openRunsDatabase(home, "overlap");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    for (const sql of SCHEMA) db.exec(sql);
    return db;
  } catch (e) {
    db.close();
    throw new KiboError("STORE_CORRUPT", `cannot create the overlap tables in ${home}: ${String(e)}`);
  }
}
