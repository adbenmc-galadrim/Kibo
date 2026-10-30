import type { Database } from "bun:sqlite";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { APPEND_ONLY_RUN_TABLES, noDeleteTrigger } from "../runs/run-store";
import { immediateTransaction } from "../sqlite-busy";
import { dropTables, tableExists } from "./legacy-sqlite";

export const LEGACY_RUNS_MARKER = "ticket_runs_removed_at";
export const DROPPED_RUNS_TABLES: readonly string[] = [
  "run_moments",
  "run_traces",
  "run_internal_plans",
  "run_subagent_events",
  "run_subagent_traces",
  "run_subagents",
  "run_skill_uses",
  "run_skill_calls",
  "skill_review_events",
  "skill_reviews",
  "run_denials",
  "run_overlap_events",
  "run_overlap_ignores",
  "run_overlaps",
  "run_auto_link_events",
  "run_auto_links",
  "project_signal_events",
  "project_signals",
];

export type LegacyRunsResult = { removedRuns: number; removedRunIds: string[]; droppedTables: string[] };

const TICKET_RUNS = "SELECT id FROM runs WHERE kind = 'ticket'";
const SAFE_RUN_ID = /^[\w-]+$/;

function ensureMarkerTable(db: Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS host_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
}

function hasMarker(db: Database): boolean {
  return (
    db.query("SELECT 1 AS found FROM host_settings WHERE key = $key").get({ key: LEGACY_RUNS_MARKER }) !==
    null
  );
}

function ensureKindColumn(db: Database): void {
  const columns = db.query("PRAGMA table_info(runs)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "kind"))
    db.exec("ALTER TABLE runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'ticket'");
}

function removeTicketRuns(db: Database): string[] {
  if (!tableExists(db, "runs")) return [];
  ensureKindColumn(db);
  const ids = (db.query(`${TICKET_RUNS} ORDER BY id`).all() as { id: string }[]).map((r) => r.id);
  for (const table of APPEND_ONLY_RUN_TABLES) db.exec(`DROP TRIGGER IF EXISTS ${table}_no_delete`);
  for (const table of ["run_events", "run_tokens"])
    if (tableExists(db, table)) db.exec(`DELETE FROM ${table} WHERE run_id IN (${TICKET_RUNS})`);
  db.exec("DELETE FROM runs WHERE kind = 'ticket'");
  for (const table of APPEND_ONLY_RUN_TABLES) if (tableExists(db, table)) db.exec(noDeleteTrigger(table));
  return ids;
}

export function migrateLegacyRuns(
  db: Database,
  now: () => number,
  tables: readonly string[] = DROPPED_RUNS_TABLES,
): LegacyRunsResult | null {
  ensureMarkerTable(db);
  return immediateTransaction(db, (): LegacyRunsResult | null => {
    if (hasMarker(db)) return null;
    const removedRunIds = removeTicketRuns(db);
    const droppedTables = dropTables(db, tables);
    db.query("INSERT INTO host_settings (key, value) VALUES ($key, $value)").run({
      key: LEGACY_RUNS_MARKER,
      value: JSON.stringify(String(now())),
    });
    return { removedRuns: removedRunIds.length, removedRunIds, droppedTables };
  })();
}

export function removeLegacyRunDirs(home: string, runIds: string[]): void {
  for (const id of runIds)
    if (SAFE_RUN_ID.test(id)) rmSync(join(home, "runs", id), { recursive: true, force: true });
}
