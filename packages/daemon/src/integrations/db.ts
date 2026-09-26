import type { Database } from "bun:sqlite";

const TABLES = [
  "CREATE TABLE IF NOT EXISTS integration_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS integration_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, integration TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sync_items (binding_id TEXT NOT NULL, remote_id TEXT NOT NULL, ticket_id TEXT NOT NULL, base_json TEXT NOT NULL, remote_updated_at TEXT NOT NULL, last_pushed_hash TEXT, PRIMARY KEY (binding_id, remote_id))",
  "DROP INDEX IF EXISTS sync_items_ticket",
  "CREATE UNIQUE INDEX IF NOT EXISTS sync_items_linked_ticket ON sync_items (binding_id, ticket_id) WHERE ticket_id <> ''",
  "CREATE TABLE IF NOT EXISTS sync_cursors (binding_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, cursor TEXT, last_pull_at INTEGER, last_error TEXT, imported INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, binding_id TEXT NOT NULL, project_id TEXT NOT NULL, ticket_id TEXT NOT NULL, op TEXT NOT NULL, payload_json TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER, first_attempt_at TEXT, last_error TEXT, created_at INTEGER NOT NULL, uncertain INTEGER NOT NULL DEFAULT 0)",
  "CREATE INDEX IF NOT EXISTS sync_outbox_binding ON sync_outbox (binding_id, id)",
  "CREATE TABLE IF NOT EXISTS ci_runs (repo TEXT NOT NULL, run_id INTEGER NOT NULL, project_id TEXT NOT NULL, head_sha TEXT NOT NULL, head_branch TEXT, pr_number INTEGER, workflow TEXT NOT NULL, status TEXT NOT NULL, conclusion TEXT, url TEXT NOT NULL, started_at TEXT, updated_at TEXT NOT NULL, notified INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (repo, run_id))",
  "CREATE TABLE IF NOT EXISTS ci_jobs (run_id INTEGER NOT NULL, job_id INTEGER PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, conclusion TEXT, started_at TEXT, completed_at TEXT, log_path TEXT, log_fetched_at INTEGER, steps_json TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS mcp_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, transport TEXT NOT NULL, command TEXT, args_json TEXT NOT NULL, env_names_json TEXT NOT NULL, url TEXT, bearer INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, command_line TEXT NOT NULL, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS mcp_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, server TEXT NOT NULL, tool TEXT NOT NULL, instance_id TEXT, duration_ms INTEGER NOT NULL, ok INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS figma_cache (file_key TEXT NOT NULL, node_id TEXT NOT NULL, png_path TEXT NOT NULL, fetched_at INTEGER NOT NULL, PRIMARY KEY (file_key, node_id))",
];

function addOutboxUncertainColumn(db: Database): void {
  const columns = db.query<{ name: string }, []>("PRAGMA table_info(sync_outbox)").all();
  if (columns.some((c) => c.name === "uncertain")) return;
  db.exec("ALTER TABLE sync_outbox ADD COLUMN uncertain INTEGER NOT NULL DEFAULT 0");
}

export function migrateIntegrations(db: Database): void {
  db.transaction(() => {
    for (const sql of TABLES) db.exec(sql);
    addOutboxUncertainColumn(db);
  })();
}
