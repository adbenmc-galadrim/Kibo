import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  AgentRef,
  AgentScope,
  HostSettings,
  KiboError,
  parseAgentRef,
  RunEvent,
  RunKind,
  type RunLogEntry,
  type RunRecord,
  systemAgentName,
} from "@kibo/schema";
import { immediateTransaction, SQLITE_BUSY_TIMEOUT_MS } from "../sqlite-busy";
import { vacuumFileInto } from "../sqlite-vacuum";

export type NewRun = Omit<RunRecord, "seq" | "createdAt">;
export type StoredEvent = RunLogEntry & { runId: string };
export type RunStore = {
  create(run: NewRun, rank: number, at: number): RunRecord;
  append(runId: string, event: RunEvent, at: number): RunLogEntry;
  records(): RunRecord[];
  events(): StoredEvent[];
  log(runId: string): RunLogEntry[];
  saveTokenHash(runId: string, hash: string, at: number): void;
  tokenHash(runId: string): string | null;
  hostSettings(): Partial<HostSettings>;
  saveHostSettings(patch: Partial<HostSettings>): void;
  marker(key: string): string | null;
  setMarker(key: string, value: string): void;
  rewriteAgentRefs(
    map: Readonly<Record<string, AgentRef>>,
    projectKeys?: Readonly<Record<string, string>>,
  ): number;
  vacuumInto(path: string): void;
  close(): void;
};

const APPEND_ONLY = ["runs", "run_events", "run_tokens"];
const noUpdate = (table: string) =>
  `CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END`;
const RUNS_NO_UPDATE = noUpdate("runs");
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, seq INTEGER NOT NULL UNIQUE, project_id TEXT, " +
    "ticket_id TEXT, ticket_key TEXT, ticket_title TEXT NOT NULL, profile_id TEXT NOT NULL, " +
    "profile_name TEXT NOT NULL, session_id TEXT NOT NULL, brief TEXT NOT NULL, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS run_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), " +
    "at INTEGER NOT NULL, data TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS run_events_by_run ON run_events (run_id, id)",
  "CREATE TABLE IF NOT EXISTS run_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), " +
    "hash TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS host_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  ...APPEND_ONLY.flatMap((t) => [
    noUpdate(t),
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
  ]),
];

type RunRow = {
  id: string;
  seq: number;
  project_id: string | null;
  ticket_id: string | null;
  ticket_key: string | null;
  ticket_title: string;
  profile_id: string;
  profile_name: string;
  session_id: string;
  brief: string;
  created_at: number;
  resumed_from: string | null;
  kind: string;
  agent_scope: string;
  project_key: string | null;
};
type EventRow = { id: number; run_id: string; at: number; data: string };

const PROJECT_RUNS = "kind = 'project'";

function toKind(r: RunRow): RunKind {
  const parsed = RunKind.safeParse(r.kind);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `run ${r.id}: unknown kind ${r.kind}`);
  return parsed.data;
}

const scopeOfRef = (ref: string): AgentScope =>
  ref.startsWith("project:") ? "project" : ref.startsWith("system:") ? "system" : "global";
const keyOfTicket = (ticketKey: string | null): string | null => ticketKey?.split("-")[0] ?? null;

function toScope(r: RunRow): AgentScope {
  const parsed = AgentScope.safeParse(r.agent_scope);
  if (!parsed.success)
    throw new KiboError("STORE_CORRUPT", `run ${r.id}: unknown agent scope ${r.agent_scope}`);
  return parsed.data;
}

function agentNameOf(ref: AgentRef): string {
  const parsed = parseAgentRef(ref);
  return parsed.scope === "system" ? systemAgentName(parsed.id) : parsed.name;
}

const toRecord = (r: RunRow): RunRecord => ({
  id: r.id,
  kind: toKind(r),
  seq: r.seq,
  projectId: r.project_id,
  ticketId: r.ticket_id,
  ticketKey: r.ticket_key,
  ticketTitle: r.ticket_title,
  profileId: r.profile_id,
  profileName: r.profile_name,
  agentScope: toScope(r),
  projectKey: r.project_key ?? keyOfTicket(r.ticket_key),
  sessionId: r.session_id,
  brief: r.brief,
  createdAt: r.created_at,
  resumedFrom: r.resumed_from,
});

function addResumedFrom(db: Database): void {
  const columns = db.query("PRAGMA table_info(runs)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "resumed_from"))
    db.exec("ALTER TABLE runs ADD COLUMN resumed_from TEXT");
}

function addKind(db: Database): void {
  const columns = db.query("PRAGMA table_info(runs)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "kind"))
    db.exec("ALTER TABLE runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'ticket'");
}

function addAgentColumns(db: Database): void {
  const columns = db.query("PRAGMA table_info(runs)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "agent_scope"))
    db.exec("ALTER TABLE runs ADD COLUMN agent_scope TEXT NOT NULL DEFAULT 'global'");
  if (!columns.some((c) => c.name === "project_key")) db.exec("ALTER TABLE runs ADD COLUMN project_key TEXT");
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `${what}: ${String(e)}`);
  }
}

function toEntry(row: EventRow): StoredEvent {
  const parsed = RunEvent.safeParse(parseJson(row.data, `run event ${row.id}`));
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `run event ${row.id}: ${parsed.error.message}`);
  return { id: row.id, runId: row.run_id, at: row.at, event: parsed.data };
}

export function openRunStore(home: string): RunStore {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const file = join(home, "runs.db");
  let db: Database;
  try {
    db = new Database(file, { create: true, strict: true });
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = FULL");
    db.exec("PRAGMA foreign_keys = ON");
    for (const sql of SCHEMA) db.exec(sql);
    addResumedFrom(db);
    addKind(db);
    addAgentColumns(db);
    const check = db.query("PRAGMA integrity_check").get() as { integrity_check: string } | null;
    if (check?.integrity_check !== "ok") throw new Error(check?.integrity_check ?? "integrity_check failed");
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot open ${file}: ${String(e)}`);
  }
  for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) chmodSync(f, 0o600);

  const nextSeq = db.query("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM runs");
  const insertRun = db.query(
    "INSERT INTO runs (id, seq, project_id, ticket_id, ticket_key, ticket_title, profile_id, profile_name, " +
      "session_id, brief, created_at, resumed_from, kind, agent_scope, project_key) VALUES ($id, $seq, $project_id, " +
      "$ticket_id, $ticket_key, $ticket_title, $profile_id, $profile_name, $session_id, $brief, $created_at, " +
      "$resumed_from, $kind, $agent_scope, $project_key)",
  );
  const runExists = db.query("SELECT 1 AS found FROM runs WHERE id = $id");
  const insertEvent = db.query(
    "INSERT INTO run_events (run_id, at, data) VALUES ($run_id, $at, $data) RETURNING id",
  );
  const insertToken = db.query("INSERT INTO run_tokens (run_id, hash, at) VALUES ($run_id, $hash, $at)");
  const lastToken = db.query("SELECT hash FROM run_tokens WHERE run_id = $run_id ORDER BY id DESC LIMIT 1");
  const upsertSetting = db.query(
    "INSERT INTO host_settings (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );

  const create = immediateTransaction(db, (run: NewRun, rank: number, at: number): RunRecord => {
    const { seq } = nextSeq.get() as { seq: number };
    insertRun.run({
      id: run.id,
      seq,
      project_id: run.projectId,
      ticket_id: run.ticketId,
      ticket_key: run.ticketKey,
      ticket_title: run.ticketTitle,
      profile_id: run.profileId,
      profile_name: run.profileName,
      session_id: run.sessionId,
      brief: run.brief,
      created_at: at,
      resumed_from: run.resumedFrom,
      kind: run.kind,
      agent_scope: run.agentScope,
      project_key: run.projectKey,
    });
    const enqueued: RunEvent = { type: "enqueued", rank };
    insertEvent.get({ run_id: run.id, at, data: JSON.stringify(enqueued) });
    return { ...run, seq, createdAt: at };
  });

  const selectSetting = db.query("SELECT value FROM host_settings WHERE key = $key");
  const updateRef = db.query(
    "UPDATE runs SET profile_id = $profile_id, profile_name = $profile_name, agent_scope = $agent_scope, " +
      "project_key = $project_key WHERE id = $id",
  );

  const rewriteAgentRefs = immediateTransaction(
    db,
    (map: Readonly<Record<string, AgentRef>>, projectKeys: Readonly<Record<string, string>>): number => {
      db.exec("DROP TRIGGER IF EXISTS runs_no_update");
      let rewritten = 0;
      for (const row of db.query("SELECT * FROM runs ORDER BY seq").all() as RunRow[]) {
        const mapped = map[row.profile_id];
        const ref = mapped ?? row.profile_id;
        if (mapped !== undefined && mapped !== row.profile_id) rewritten += 1;
        const valid = AgentRef.safeParse(ref);
        updateRef.run({
          id: row.id,
          profile_id: ref,
          profile_name: valid.success ? agentNameOf(valid.data) : row.profile_name,
          agent_scope: scopeOfRef(ref),
          project_key:
            row.project_key ??
            (row.project_id === null ? undefined : projectKeys[row.project_id]) ??
            keyOfTicket(row.ticket_key),
        });
      }
      db.exec(RUNS_NO_UPDATE);
      return rewritten;
    },
  );

  const requireRun = (runId: string) => {
    if (!runExists.get({ id: runId })) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
  };

  return {
    create: (run, rank, at) => create(run, rank, at),
    append(runId, event, at) {
      requireRun(runId);
      const row = insertEvent.get({ run_id: runId, at, data: JSON.stringify(event) }) as { id: number };
      return { id: row.id, at, event };
    },
    records: () =>
      (db.query(`SELECT * FROM runs WHERE ${PROJECT_RUNS} ORDER BY seq`).all() as RunRow[]).map(toRecord),
    events: () =>
      (
        db
          .query(
            `SELECT * FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE ${PROJECT_RUNS}) ORDER BY id`,
          )
          .all() as EventRow[]
      ).map(toEntry),
    log: (runId) =>
      (
        db
          .query("SELECT * FROM run_events WHERE run_id = $run_id ORDER BY id")
          .all({ run_id: runId }) as EventRow[]
      )
        .map(toEntry)
        .map(({ runId: _runId, ...entry }) => entry),
    saveTokenHash(runId, hash, at) {
      requireRun(runId);
      insertToken.run({ run_id: runId, hash, at });
    },
    tokenHash: (runId) => (lastToken.get({ run_id: runId }) as { hash: string } | null)?.hash ?? null,
    hostSettings() {
      const rows = db.query("SELECT key, value FROM host_settings").all() as { key: string; value: string }[];
      const raw = Object.fromEntries(rows.map((r) => [r.key, parseJson(r.value, `host setting ${r.key}`)]));
      const parsed = HostSettings.partial().safeParse(raw);
      if (!parsed.success) throw new KiboError("STORE_CORRUPT", `host settings: ${parsed.error.message}`);
      return parsed.data;
    },
    saveHostSettings(patch) {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) upsertSetting.run({ key, value: JSON.stringify(value) });
      }
    },
    marker(key) {
      const row = selectSetting.get({ key }) as { value: string } | null;
      if (!row) return null;
      const value = parseJson(row.value, `host setting ${key}`);
      return typeof value === "string" ? value : null;
    },
    setMarker(key, value) {
      upsertSetting.run({ key, value: JSON.stringify(value) });
    },
    rewriteAgentRefs: (map, projectKeys = {}) => rewriteAgentRefs(map, projectKeys),
    vacuumInto: (path) => vacuumFileInto(file, path),
    close: () => db.close(),
  };
}
