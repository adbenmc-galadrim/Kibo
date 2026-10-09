import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  type Batch,
  BatchEvent,
  type BatchRow,
  ExpectedState,
  foldBatch,
  KiboError,
  type ProjectAgentSession,
  type ProjectFingerprint,
  ProjectFingerprintSchema,
  ProposedAction,
  type TimedBatchEvent,
} from "@kibo/schema";
import { z } from "zod";
import { immediateTransaction, SQLITE_BUSY_TIMEOUT_MS } from "../sqlite-busy";

export type NewBatch = Omit<BatchRow, "seq">;
export type ProjectAgentStore = {
  openSession(projectId: string): ProjectAgentSession | null;
  openSessions(): ProjectAgentSession[];
  sessions(projectId: string): ProjectAgentSession[];
  startSession(s: Omit<ProjectAgentSession, "closedAt" | "lastTurnAt">): ProjectAgentSession;
  closeSession(runId: string, at: number): void;
  fingerprint(runId: string): ProjectFingerprint | null;
  saveFingerprint(runId: string, fp: ProjectFingerprint, at: number): void;
  createBatch(row: NewBatch): Batch;
  appendBatchEvent(batchId: string, event: BatchEvent, at: number): Batch;
  batch(batchId: string): Batch | null;
  batches(runId: string): Batch[];
  pendingBatch(projectId: string): Batch | null;
  lastDecided(projectId: string, since: number): Batch | null;
  close(): void;
};

const APPEND_ONLY = ["project_agent_batches", "project_agent_batch_events"];
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS project_agent_sessions (run_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, " +
    "session_id TEXT NOT NULL, started_at INTEGER NOT NULL, closed_at INTEGER, fingerprint TEXT, last_turn_at INTEGER)",
  "CREATE UNIQUE INDEX IF NOT EXISTS project_agent_sessions_open ON project_agent_sessions (project_id) " +
    "WHERE closed_at IS NULL",
  "CREATE TABLE IF NOT EXISTS project_agent_batches (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, " +
    "run_id TEXT NOT NULL, session_id TEXT NOT NULL, seq INTEGER NOT NULL, summary TEXT NOT NULL, " +
    "actions TEXT NOT NULL, expected TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (project_id, seq))",
  "CREATE INDEX IF NOT EXISTS project_agent_batches_by_run ON project_agent_batches (run_id, seq)",
  "CREATE TABLE IF NOT EXISTS project_agent_batch_events (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "batch_id TEXT NOT NULL REFERENCES project_agent_batches(id), at INTEGER NOT NULL, data TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS project_agent_batch_events_by_batch ON project_agent_batch_events (batch_id, id)",
  ...APPEND_ONLY.flatMap((t) => [
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
  ]),
];

type SessionRow = {
  run_id: string;
  project_id: string;
  session_id: string;
  started_at: number;
  closed_at: number | null;
  last_turn_at: number | null;
};
type BatchDbRow = {
  id: string;
  project_id: string;
  run_id: string;
  session_id: string;
  seq: number;
  summary: string;
  actions: string;
  expected: string;
  created_at: number;
};
type EventRow = { id: number; at: number; data: string };

const Actions = z.array(ProposedAction);
const Expected = z.array(ExpectedState);

function parseStored<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, text: string, what: string): T {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `${what}: ${String(e)}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `${what}: ${parsed.error.message}`);
  return parsed.data;
}

const toSession = (r: SessionRow): ProjectAgentSession => ({
  projectId: r.project_id,
  runId: r.run_id,
  sessionId: r.session_id,
  startedAt: r.started_at,
  closedAt: r.closed_at,
  lastTurnAt: r.last_turn_at,
});

const toRow = (r: BatchDbRow): BatchRow => ({
  id: r.id,
  projectId: r.project_id,
  runId: r.run_id,
  sessionId: r.session_id,
  seq: r.seq,
  summary: r.summary,
  actions: parseStored(Actions, r.actions, `batch ${r.id} actions`),
  expected: parseStored(Expected, r.expected, `batch ${r.id} expected`),
  createdAt: r.created_at,
});

const toEvent = (r: EventRow): TimedBatchEvent => ({
  at: r.at,
  event: parseStored(BatchEvent, r.data, `batch event ${r.id}`),
});

function openDatabase(home: string): Database {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const file = join(home, "runs.db");
  try {
    const db = new Database(file, { create: true, strict: true });
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = FULL");
    db.exec("PRAGMA foreign_keys = ON");
    for (const sql of SCHEMA) db.exec(sql);
    for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) chmodSync(f, 0o600);
    return db;
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot open the project agent tables in ${file}: ${String(e)}`);
  }
}

export function openProjectAgentStore(home: string): ProjectAgentStore {
  const db = openDatabase(home);
  const sessionsOf = db.query(
    "SELECT * FROM project_agent_sessions WHERE project_id = $project_id ORDER BY started_at DESC, rowid DESC",
  );
  const openOf = db.query(
    "SELECT * FROM project_agent_sessions WHERE project_id = $project_id AND closed_at IS NULL",
  );
  const insertSession = db.query(
    "INSERT INTO project_agent_sessions (run_id, project_id, session_id, started_at) " +
      "VALUES ($run_id, $project_id, $session_id, $started_at)",
  );
  const batchById = db.query("SELECT * FROM project_agent_batches WHERE id = $id");
  const eventsOf = db.query(
    "SELECT id, at, data FROM project_agent_batch_events WHERE batch_id = $batch_id ORDER BY id",
  );
  const nextSeq = db.query(
    "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM project_agent_batches WHERE project_id = $project_id",
  );
  const insertBatch = db.query(
    "INSERT INTO project_agent_batches (id, project_id, run_id, session_id, seq, summary, actions, expected, " +
      "created_at) VALUES ($id, $project_id, $run_id, $session_id, $seq, $summary, $actions, $expected, $created_at)",
  );
  const insertEvent = db.query(
    "INSERT INTO project_agent_batch_events (batch_id, at, data) VALUES ($batch_id, $at, $data)",
  );

  const folded = (row: BatchDbRow): Batch =>
    foldBatch(toRow(row), (eventsOf.all({ batch_id: row.id }) as EventRow[]).map(toEvent));
  const batch = (id: string): Batch | null => {
    const row = batchById.get({ id }) as BatchDbRow | null;
    return row ? folded(row) : null;
  };
  const first = (sql: string, params: Record<string, string | number>): Batch | null => {
    const row = db.query(sql).get(params) as BatchDbRow | null;
    return row ? folded(row) : null;
  };

  const startSession = immediateTransaction(db, (s: Omit<ProjectAgentSession, "closedAt" | "lastTurnAt">) => {
    if (openOf.get({ project_id: s.projectId }))
      throw new KiboError("CONFLICT", `project ${s.projectId} already has an open project agent session`);
    insertSession.run({
      run_id: s.runId,
      project_id: s.projectId,
      session_id: s.sessionId,
      started_at: s.startedAt,
    });
    return { ...s, closedAt: null, lastTurnAt: null };
  });
  const createBatch = immediateTransaction(db, (row: NewBatch): Batch => {
    const { seq } = nextSeq.get({ project_id: row.projectId }) as { seq: number };
    insertBatch.run({
      id: row.id,
      project_id: row.projectId,
      run_id: row.runId,
      session_id: row.sessionId,
      seq,
      summary: row.summary,
      actions: JSON.stringify(row.actions),
      expected: JSON.stringify(row.expected),
      created_at: row.createdAt,
    });
    return foldBatch({ ...row, seq }, []);
  });

  return {
    openSession(projectId) {
      const row = openOf.get({ project_id: projectId }) as SessionRow | null;
      return row ? toSession(row) : null;
    },
    openSessions: () =>
      (
        db
          .query("SELECT * FROM project_agent_sessions WHERE closed_at IS NULL ORDER BY project_id")
          .all() as SessionRow[]
      ).map(toSession),
    sessions: (projectId) => (sessionsOf.all({ project_id: projectId }) as SessionRow[]).map(toSession),
    startSession: (s) => startSession(s),
    closeSession(runId, at) {
      db.query(
        "UPDATE project_agent_sessions SET closed_at = $at WHERE run_id = $run_id AND closed_at IS NULL",
      ).run({
        run_id: runId,
        at,
      });
    },
    fingerprint(runId) {
      const row = db.query("SELECT fingerprint FROM project_agent_sessions WHERE run_id = $run_id").get({
        run_id: runId,
      }) as { fingerprint: string | null } | null;
      if (!row?.fingerprint) return null;
      return parseStored(ProjectFingerprintSchema, row.fingerprint, `fingerprint of run ${runId}`);
    },
    saveFingerprint(runId, fp, at) {
      db.query(
        "UPDATE project_agent_sessions SET fingerprint = $fingerprint, last_turn_at = $at WHERE run_id = $run_id",
      ).run({ run_id: runId, fingerprint: JSON.stringify(fp), at });
    },
    createBatch: (row) => createBatch(row),
    appendBatchEvent(batchId, event, at) {
      const row = batchById.get({ id: batchId }) as BatchDbRow | null;
      if (!row) throw new KiboError("NOT_FOUND", `batch ${batchId} not found`);
      insertEvent.run({ batch_id: batchId, at, data: JSON.stringify(event) });
      return folded(row);
    },
    batch,
    batches: (runId) =>
      (
        db.query("SELECT * FROM project_agent_batches WHERE run_id = $run_id ORDER BY seq").all({
          run_id: runId,
        }) as BatchDbRow[]
      ).map(folded),
    pendingBatch: (projectId) =>
      first(
        "SELECT b.* FROM project_agent_batches b WHERE b.project_id = $project_id AND NOT EXISTS " +
          "(SELECT 1 FROM project_agent_batch_events e WHERE e.batch_id = b.id) ORDER BY b.seq DESC LIMIT 1",
        { project_id: projectId },
      ),
    lastDecided: (projectId, since) =>
      first(
        "SELECT b.* FROM project_agent_batches b JOIN project_agent_batch_events e ON e.batch_id = b.id " +
          "WHERE b.project_id = $project_id AND e.at >= $since AND json_extract(e.data, '$.type') = 'decided' " +
          "ORDER BY e.at DESC, e.id DESC LIMIT 1",
        { project_id: projectId, since },
      ),
    close: () => db.close(),
  };
}
