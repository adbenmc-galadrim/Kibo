import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createWorkspaceDoc } from "@kibo/core/workspace";
import { PROJECT_AGENT_REF } from "@kibo/schema";
import { openProjectAgentStore } from "../project-agent/store";
import { openWakeupStore } from "../project-agent/wakeup/store";
import { WORKSPACE_DOC_ID } from "../projects/doc-ids";
import { openRunStore } from "../runs/run-store";
import { openStore } from "../store";

export const FIXTURE_HOME_032 = join(import.meta.dir, "fixtures", "kibo-home-0.32");
export const FIXTURE_032 = {
  projectId: "6e2d3c4b-5f60-4b7c-9d8e-0f1a2b3c4d5e",
  ticketRuns: ["t-run-1", "t-run-2", "t-run-3", "t-creation"],
  projectRuns: ["p1", "p2"],
  eventsOfProjectRuns: 5,
  batchId: "b1",
} as const;

const DEAD_RUNS_TABLES = [
  "CREATE TABLE run_moments (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, seq INTEGER NOT NULL, at INTEGER NOT NULL, step_id TEXT, kind TEXT NOT NULL, data TEXT NOT NULL, subagent_id TEXT, UNIQUE (run_id, seq))",
  "CREATE TABLE run_traces (run_id TEXT PRIMARY KEY, path TEXT, offset INTEGER NOT NULL, source TEXT NOT NULL, partial TEXT, doing_step TEXT, base_head TEXT, closed_at INTEGER)",
  "CREATE TABLE run_internal_plans (run_id TEXT PRIMARY KEY, plan TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE TABLE run_subagents (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, tool_use_id TEXT, type TEXT NOT NULL, description TEXT NOT NULL, prompt TEXT NOT NULL, model TEXT, parent_id TEXT, transcript_path TEXT, started_at INTEGER NOT NULL)",
  "CREATE TABLE run_subagent_events (id INTEGER PRIMARY KEY AUTOINCREMENT, subagent_id TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE TABLE run_subagent_traces (subagent_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, path TEXT NOT NULL, offset INTEGER NOT NULL, closed_at INTEGER)",
  "CREATE TABLE run_skill_uses (run_id TEXT NOT NULL, skill_id TEXT NOT NULL, count INTEGER NOT NULL, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY (run_id, skill_id))",
  "CREATE TABLE run_skill_calls (run_id TEXT NOT NULL, call_id TEXT NOT NULL, PRIMARY KEY (run_id, call_id))",
  "CREATE TABLE skill_reviews (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, run_label TEXT NOT NULL, agent_name TEXT NOT NULL, project_id TEXT, ticket_id TEXT, ticket_key TEXT, skill_id TEXT NOT NULL, skill_path TEXT, base_hash TEXT, verdict TEXT NOT NULL, note TEXT NOT NULL, suggestion TEXT, created_at INTEGER NOT NULL)",
  "CREATE TABLE skill_review_events (id INTEGER PRIMARY KEY AUTOINCREMENT, review_id TEXT NOT NULL REFERENCES skill_reviews(id), type TEXT NOT NULL, by TEXT, at INTEGER NOT NULL, version_id TEXT)",
  "CREATE TABLE run_denials (run_id TEXT NOT NULL, turn INTEGER NOT NULL, items TEXT NOT NULL, question_id TEXT, seq INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (run_id, turn))",
  "CREATE TABLE run_overlaps (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, owner_run_id TEXT NOT NULL, other_run_id TEXT NOT NULL, owner_workspace TEXT NOT NULL, other_workspace TEXT NOT NULL, detail TEXT NOT NULL, first_seen_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, open INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE run_overlap_events (id INTEGER PRIMARY KEY AUTOINCREMENT, overlap_id TEXT NOT NULL REFERENCES run_overlaps(id), type TEXT NOT NULL, role TEXT, by TEXT, at INTEGER NOT NULL)",
  "CREATE TABLE run_overlap_ignores (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, label TEXT NOT NULL, by TEXT NOT NULL, at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE run_auto_links (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, link_id TEXT NOT NULL, from_ticket_id TEXT NOT NULL, to_ticket_id TEXT NOT NULL, from_ticket_key TEXT NOT NULL, to_ticket_key TEXT NOT NULL, owner_run_id TEXT NOT NULL, other_run_id TEXT NOT NULL, reason TEXT NOT NULL, path TEXT NOT NULL, name TEXT, at INTEGER NOT NULL)",
  "CREATE TABLE run_auto_link_events (id INTEGER PRIMARY KEY AUTOINCREMENT, auto_link_id TEXT NOT NULL REFERENCES run_auto_links(id), type TEXT NOT NULL, by TEXT, at INTEGER NOT NULL)",
  "CREATE TABLE project_signals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, seq INTEGER NOT NULL, run_id TEXT NOT NULL, run_label TEXT NOT NULL, profile_name TEXT NOT NULL, origin_ticket_id TEXT NOT NULL, origin_ticket_key TEXT NOT NULL, ticket_id TEXT NOT NULL, ticket_key TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (project_id, seq))",
  "CREATE TABLE project_signal_events (id INTEGER PRIMARY KEY AUTOINCREMENT, signal_id TEXT NOT NULL REFERENCES project_signals(id), at INTEGER NOT NULL, data TEXT NOT NULL)",
];

const DEAD_RUNS_ROWS = [
  "INSERT INTO run_moments (run_id, seq, at, kind, data) VALUES ('t-run-1', 1, 1, 'step', '{}')",
  "INSERT INTO run_traces (run_id, offset, source) VALUES ('t-run-1', 0, 'cli')",
  "INSERT INTO run_internal_plans VALUES ('t-run-1', '[]', 1)",
  "INSERT INTO run_subagents (id, run_id, type, description, prompt, started_at) VALUES ('sa1', 't-run-1', 'Explore', 'd', 'p', 1)",
  "INSERT INTO run_subagent_events (subagent_id, type, data, at) VALUES ('sa1', 'started', '{}', 1)",
  "INSERT INTO run_subagent_traces VALUES ('sa1', 't-run-1', '/tmp/x', 0, NULL)",
  "INSERT INTO run_skill_uses VALUES ('t-run-1', 'tdd', 1, 1, 1)",
  "INSERT INTO run_skill_calls VALUES ('t-run-1', 'c1')",
  "INSERT INTO skill_reviews (id, run_id, run_label, agent_name, skill_id, verdict, note, created_at) VALUES ('sr1', 't-run-1', 'SILO-1', 'opus', 'tdd', 'ok', '', 1)",
  "INSERT INTO skill_review_events (review_id, type, at) VALUES ('sr1', 'created', 1)",
  "INSERT INTO run_denials VALUES ('t-run-1', 1, '[]', NULL, 1, 1)",
  "INSERT INTO run_overlaps (id, project_id, kind, key, owner_run_id, other_run_id, owner_workspace, other_workspace, detail, first_seen_at, last_seen_at) VALUES ('ov1', 'x', 'file', 'a.ts', 't-run-1', 't-run-2', 'w1', 'w2', '', 1, 1)",
  "INSERT INTO run_overlap_events (overlap_id, type, at) VALUES ('ov1', 'opened', 1)",
  "INSERT INTO run_overlap_ignores (project_id, kind, key, label, by, at) VALUES ('x', 'file', 'a.ts', 'a', 'adam', 1)",
  "INSERT INTO run_auto_links VALUES ('al1', 'x', 'l1', 't1', 't2', 'SILO-1', 'SILO-2', 't-run-1', 't-run-2', 'file', 'a.ts', NULL, 1)",
  "INSERT INTO run_auto_link_events (auto_link_id, type, at) VALUES ('al1', 'created', 1)",
  "INSERT INTO project_signals VALUES ('sig1', 'x', 1, 't-run-1', 'SILO-1', 'opus', 't1', 'SILO-1', 't2', 'SILO-2', 'blocked', 'T', 'B', 1)",
  "INSERT INTO project_signal_events (signal_id, at, data) VALUES ('sig1', 1, '{}')",
];

const appendOnly = (table: string) => [
  `CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
  `CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
];

const DEAD_KIBO = [
  "CREATE TABLE agent_settings (ref TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  "INSERT INTO agent_settings VALUES ('global:opus', '{}', 1)",
  "CREATE TABLE file_versions (id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref TEXT NOT NULL, file TEXT NOT NULL, hash TEXT NOT NULL, size INTEGER NOT NULL, at INTEGER NOT NULL, origin TEXT NOT NULL, by TEXT, note TEXT)",
  "INSERT INTO file_versions VALUES ('v1', 'agent', 'global:opus', 'opus.md', 'h', 1, 1, 'user', NULL, NULL)",
  "CREATE TABLE component_drafts (id TEXT PRIMARY KEY, componentId TEXT NOT NULL, mode TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, withServer INTEGER NOT NULL, baseVersion TEXT, description TEXT NOT NULL, runId TEXT, sessionId TEXT, status TEXT NOT NULL, attempts INTEGER NOT NULL, failureJson TEXT, incidentsJson TEXT NOT NULL, reportJson TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)",
  "INSERT INTO component_drafts (id, componentId, mode, title, kind, withServer, description, status, attempts, incidentsJson, createdAt, updatedAt) VALUES ('d1', 'c', 'new', 'T', 'ui', 0, '', 'done', 1, '[]', 1, 1)",
  "CREATE TABLE market_sources (id TEXT PRIMARY KEY, url TEXT NOT NULL, name TEXT NOT NULL)",
  "INSERT INTO market_sources VALUES ('s1', 'https://example.test', 'Équipe')",
  "CREATE TABLE market_pins (sourceId TEXT NOT NULL, componentId TEXT NOT NULL, PRIMARY KEY (sourceId, componentId))",
  "CREATE TABLE market_index_cache (sourceId TEXT PRIMARY KEY, bytes BLOB NOT NULL)",
  "CREATE TABLE sync_items (binding_id TEXT NOT NULL, remote_id TEXT NOT NULL, ticket_id TEXT NOT NULL, PRIMARY KEY (binding_id, remote_id))",
  "CREATE INDEX sync_items_linked_ticket ON sync_items (ticket_id)",
  "CREATE TABLE sync_cursors (binding_id TEXT PRIMARY KEY, project_id TEXT NOT NULL)",
  "CREATE TABLE sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, binding_id TEXT NOT NULL, project_id TEXT NOT NULL)",
  "CREATE INDEX sync_outbox_binding ON sync_outbox (binding_id, id)",
  "CREATE TABLE sync_config (id INTEGER PRIMARY KEY CHECK (id = 1), serverUrl TEXT NOT NULL, caFile TEXT, userId TEXT NOT NULL, deviceId TEXT NOT NULL, displayName TEXT NOT NULL)",
  "INSERT INTO sync_config VALUES (1, 'wss://sync.silo.test', NULL, 'u-adam', 'd-mac', 'Adam')",
  "CREATE TABLE sync_projects (projectId TEXT PRIMARY KEY, enabled INTEGER NOT NULL, role TEXT NOT NULL, lastServerVersion BLOB, lastSyncAt INTEGER, lastError TEXT, accessRevoked INTEGER NOT NULL)",
  `INSERT INTO sync_projects VALUES ('${FIXTURE_032.projectId}', 0, 'owner', NULL, NULL, NULL, 0)`,
  "CREATE TABLE component_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, project_id TEXT NOT NULL, instance_id TEXT NOT NULL, ref TEXT NOT NULL, kind TEXT NOT NULL, code TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1)",
  "INSERT INTO component_events (at, project_id, instance_id, ref, kind, code) VALUES (1, 'x', 'i', 'notes', 'refusal', 'DENIED')",
  "CREATE TABLE project_events (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, at INTEGER NOT NULL, kind TEXT NOT NULL, ticket_id TEXT, feature_id TEXT, source TEXT NOT NULL, data TEXT NOT NULL)",
  "CREATE TRIGGER project_events_no_update BEFORE UPDATE ON project_events BEGIN SELECT RAISE(ABORT, 'append-only'); END",
  `INSERT INTO project_events (project_id, at, kind, source, data) VALUES ('${FIXTURE_032.projectId}', 1, 'status', 'cli', '{}')`,
  "CREATE TABLE remote_sessions (idHash TEXT PRIMARY KEY, deviceName TEXT NOT NULL, remote INTEGER NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, lastSeenAt INTEGER NOT NULL, revokedAt INTEGER)",
  "INSERT INTO remote_sessions VALUES ('local', 'kibo-cli', 0, 1, 9999999999999, 1, NULL)",
  "INSERT INTO remote_sessions VALUES ('phone', 'iPhone', 1, 1, 9999999999999, 1, NULL)",
];

function writeKibo(home: string): void {
  const doc = createWorkspaceDoc();
  doc.commit();
  const store = openStore(home);
  store.save(WORKSPACE_DOC_ID, doc.export({ mode: "snapshot" }));
  for (const sql of DEAD_KIBO) store.db.exec(sql);
  store.db.exec("PRAGMA journal_mode = DELETE");
  store.close();
}

const projectRun = (id: string, seq: number) => ({
  id,
  seq,
  project: FIXTURE_032.projectId,
  ticket: null,
  key: null,
  title: "Agent de projet",
  profile: PROJECT_AGENT_REF,
  name: "Agent de projet",
  kind: "project",
  scope: "system",
});
const ticketRun = (id: string, seq: number, ticket: string | null) => ({
  ...projectRun(id, seq),
  ticket,
  key: ticket === null ? null : `SILO-${seq}`,
  title: ticket === null ? "Créer un composant" : `Ticket ${seq}`,
  profile: "global:opus",
  name: "opus",
  kind: "ticket",
  scope: "global",
});

const RUNS = [
  ticketRun("t-run-1", 1, "t1"),
  projectRun("p1", 2),
  ticketRun("t-run-2", 3, "t2"),
  ticketRun("t-creation", 4, null),
  projectRun("p2", 5),
  ticketRun("t-run-3", 6, "t3"),
];

const EVENTS: [string, string][] = [
  ["t-run-1", '{"type":"enqueued","rank":0}'],
  ["p1", '{"type":"enqueued","rank":0}'],
  ["p1", '{"type":"answered","text":"Où en est le sprint ?","rank":0}'],
  ["t-run-2", '{"type":"enqueued","rank":1}'],
  ["t-creation", '{"type":"enqueued","rank":2}'],
  ["p2", '{"type":"enqueued","rank":0}'],
  ["p2", '{"type":"admitted","lane":1}'],
  ["p2", '{"type":"cancelled"}'],
  ["t-run-3", '{"type":"cancelled"}'],
];

const BATCH_ACTIONS = JSON.stringify([
  { id: 1, why: "Le panneau est livré.", type: "setStatus", ticket: "SILO-2", statusId: "done" },
  { id: 2, why: "L'agent opus est libre.", type: "assignAgent", ticket: "SILO-1", profileId: "global:opus" },
]);

function writeRuns(home: string): void {
  openRunStore(home).close();
  openProjectAgentStore(home).close();
  openWakeupStore(home).close();
  const db = new Database(join(home, "runs.db"), { strict: true });
  for (const sql of DEAD_RUNS_TABLES) db.exec(sql);
  for (const table of ["run_moments", "project_signals", "skill_reviews", "run_subagents"])
    for (const sql of appendOnly(table)) db.exec(sql);
  const insert = db.query(
    "INSERT INTO runs (id, seq, project_id, ticket_id, ticket_key, ticket_title, profile_id, profile_name, " +
      "session_id, brief, created_at, resumed_from, kind, agent_scope, project_key) VALUES ($id, $seq, $project, " +
      "$ticket, $key, $title, $profile, $name, 's-' || $id, '', 1000 + $seq, NULL, $kind, $scope, 'SILO')",
  );
  for (const run of RUNS) insert.run(run);
  const event = db.query("INSERT INTO run_events (run_id, at, data) VALUES ($run, 2000, $data)");
  for (const [run, data] of EVENTS) event.run({ run, data });
  const token = db.query("INSERT INTO run_tokens (run_id, hash, at) VALUES ($run, 'h-' || $run, 2000)");
  for (const run of ["t-run-1", "p1", "t-creation", "p2", "t-run-2"]) token.run({ run });
  db.exec(
    `INSERT INTO project_agent_sessions VALUES ('p2', '${FIXTURE_032.projectId}', 's-p2', 1005, NULL, NULL, 2000)`,
  );
  db.query(
    "INSERT INTO project_agent_batches VALUES ($id, $project, 'p2', 's-p2', 1, 'Point du jour', $actions, '[]', 2000)",
  ).run({ id: FIXTURE_032.batchId, project: FIXTURE_032.projectId, actions: BATCH_ACTIONS });
  db.exec(`INSERT INTO project_agent_wakeups VALUES ('${FIXTURE_032.projectId}', 1500, 90000)`);
  db.exec(`INSERT INTO project_agent_wakeup_answers VALUES ('${FIXTURE_032.projectId}', 'q1', 1600)`);
  db.exec(`INSERT INTO host_settings VALUES ('hostSlots', '2')`);
  for (const sql of DEAD_RUNS_ROWS) db.exec(sql);
  db.exec("PRAGMA journal_mode = DELETE");
  db.close();
}

function writeRunDirs(home: string): void {
  for (const id of [...FIXTURE_032.ticketRuns, ...FIXTURE_032.projectRuns]) {
    mkdirSync(join(home, "runs", id), { recursive: true });
    writeFileSync(join(home, "runs", id, "transcript.jsonl"), "{}\n");
  }
}

const GENERATED = ["kibo.db", "runs.db", "runs", "kibo.db-wal", "kibo.db-shm", "runs.db-wal", "runs.db-shm"];

function makeHome032(home: string): void {
  for (const name of GENERATED) rmSync(join(home, name), { recursive: true, force: true });
  mkdirSync(home, { recursive: true, mode: 0o700 });
  writeKibo(home);
  writeRuns(home);
  writeRunDirs(home);
  for (const leftover of GENERATED.slice(3)) rmSync(join(home, leftover), { force: true });
}

if (import.meta.main) makeHome032(FIXTURE_HOME_032);
