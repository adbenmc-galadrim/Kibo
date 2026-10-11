import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  foldSignal,
  isOpenSignal,
  KiboError,
  type ProjectSignalCount,
  type Signal,
  SignalEvent,
  SignalKind,
  type SignalRef,
  type SignalRow,
  seqOfRef,
  type TimedSignalEvent,
  type Wakeup,
} from "@kibo/schema";
import { immediateTransaction, SQLITE_BUSY_TIMEOUT_MS } from "../sqlite-busy";

export type NewSignal = Omit<SignalRow, "seq">;
export type SignalStore = {
  create(row: NewSignal): Signal;
  appendEvent(signalId: string, event: SignalEvent, at: number): Signal;
  get(signalId: string): Signal | null;
  byRef(projectId: string, ref: SignalRef): Signal | null;
  open(projectId: string): Signal[];
  closed(projectId: string, limit: number): Signal[];
  countByRun(runId: string): number;
  duplicate(runId: string, kind: SignalKind, title: string): boolean;
  counts(): ProjectSignalCount[];
  wakeup(projectId: string): Wakeup;
  saveWakeup(w: Wakeup): void;
  due(): Wakeup[];
  close(): void;
};

const APPEND_ONLY = ["project_signals", "project_signal_events"];
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS project_signals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, seq INTEGER NOT NULL, " +
    "run_id TEXT NOT NULL, run_label TEXT NOT NULL, profile_name TEXT NOT NULL, origin_ticket_id TEXT NOT NULL, " +
    "origin_ticket_key TEXT NOT NULL, ticket_id TEXT NOT NULL, ticket_key TEXT NOT NULL, kind TEXT NOT NULL, " +
    "title TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (project_id, seq))",
  "CREATE INDEX IF NOT EXISTS project_signals_by_run ON project_signals (run_id)",
  "CREATE TABLE IF NOT EXISTS project_signal_events (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "signal_id TEXT NOT NULL REFERENCES project_signals(id), at INTEGER NOT NULL, data TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS project_signal_events_by_signal ON project_signal_events (signal_id, id)",
  "CREATE TABLE IF NOT EXISTS project_agent_wakeups (project_id TEXT PRIMARY KEY, last_at INTEGER, due_at INTEGER)",
  ...APPEND_ONLY.flatMap((t) => [
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
  ]),
];

const FINAL = "json_extract(e.data, '$.type') IN ('handled', 'ignored')";
const IS_OPEN = `NOT EXISTS (SELECT 1 FROM project_signal_events e WHERE e.signal_id = s.id AND ${FINAL})`;
const IS_UNREAD = "NOT EXISTS (SELECT 1 FROM project_signal_events e WHERE e.signal_id = s.id)";

type SignalDbRow = {
  id: string;
  project_id: string;
  seq: number;
  run_id: string;
  run_label: string;
  profile_name: string;
  origin_ticket_id: string;
  origin_ticket_key: string;
  ticket_id: string;
  ticket_key: string;
  kind: string;
  title: string;
  body: string;
  created_at: number;
};
type EventRow = { id: number; at: number; data: string };
type WakeupRow = { project_id: string; last_at: number | null; due_at: number | null };

function stored<T>(parse: () => T, what: string): T {
  try {
    return parse();
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `${what}: ${String(e)}`);
  }
}

const toRow = (r: SignalDbRow): SignalRow => ({
  id: r.id,
  seq: r.seq,
  projectId: r.project_id,
  runId: r.run_id,
  runLabel: r.run_label,
  profileName: r.profile_name,
  originTicketId: r.origin_ticket_id,
  originTicketKey: r.origin_ticket_key,
  ticketId: r.ticket_id,
  ticketKey: r.ticket_key,
  kind: stored(() => SignalKind.parse(r.kind), `signal ${r.id} kind`),
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
});

const toEvent = (r: EventRow): TimedSignalEvent => ({
  at: r.at,
  event: stored(() => SignalEvent.parse(JSON.parse(r.data)), `signal event ${r.id}`),
});

const toWakeup = (r: WakeupRow): Wakeup => ({ projectId: r.project_id, lastAt: r.last_at, dueAt: r.due_at });

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
    throw new KiboError("STORE_CORRUPT", `cannot open the signal tables in ${file}: ${String(e)}`);
  }
}

const changes = (signal: Signal, event: SignalEvent): boolean =>
  isOpenSignal(signal) && (event.type !== "read" || signal.status === "new");

export function openSignalStore(home: string): SignalStore {
  const db = openDatabase(home);
  const byId = db.query("SELECT * FROM project_signals WHERE id = $id");
  const eventsOf = db.query(
    "SELECT id, at, data FROM project_signal_events WHERE signal_id = $signal_id ORDER BY id",
  );
  const nextSeq = db.query(
    "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM project_signals WHERE project_id = $p",
  );
  const insert = db.query(
    "INSERT INTO project_signals (id, project_id, seq, run_id, run_label, profile_name, origin_ticket_id, " +
      "origin_ticket_key, ticket_id, ticket_key, kind, title, body, created_at) VALUES ($id, $project_id, $seq, " +
      "$run_id, $run_label, $profile_name, $origin_ticket_id, $origin_ticket_key, $ticket_id, $ticket_key, $kind, " +
      "$title, $body, $created_at)",
  );
  const insertEvent = db.query(
    "INSERT INTO project_signal_events (signal_id, at, data) VALUES ($signal_id, $at, $data)",
  );

  const folded = (row: SignalDbRow): Signal =>
    foldSignal(toRow(row), (eventsOf.all({ signal_id: row.id }) as EventRow[]).map(toEvent));
  const get = (id: string): Signal | null => {
    const row = byId.get({ id }) as SignalDbRow | null;
    return row ? folded(row) : null;
  };
  const many = (sql: string, params: Record<string, string | number>): Signal[] =>
    (db.query(sql).all(params) as SignalDbRow[]).map(folded);

  const create = immediateTransaction(db, (row: NewSignal): Signal => {
    const { seq } = nextSeq.get({ p: row.projectId }) as { seq: number };
    insert.run({
      id: row.id,
      project_id: row.projectId,
      seq,
      run_id: row.runId,
      run_label: row.runLabel,
      profile_name: row.profileName,
      origin_ticket_id: row.originTicketId,
      origin_ticket_key: row.originTicketKey,
      ticket_id: row.ticketId,
      ticket_key: row.ticketKey,
      kind: row.kind,
      title: row.title,
      body: row.body,
      created_at: row.createdAt,
    });
    return foldSignal({ ...row, seq }, []);
  });
  const appendEvent = immediateTransaction(db, (signalId: string, event: SignalEvent, at: number): Signal => {
    const signal = get(signalId);
    if (!signal) throw new KiboError("NOT_FOUND", `signal ${signalId} not found`);
    if (!changes(signal, event)) return signal;
    insertEvent.run({ signal_id: signalId, at, data: JSON.stringify(event) });
    return get(signalId) ?? signal;
  });

  return {
    create: (row) => create(row),
    appendEvent: (signalId, event, at) => appendEvent(signalId, event, at),
    get,
    byRef(projectId, ref) {
      const row = db
        .query("SELECT * FROM project_signals WHERE project_id = $p AND seq = $seq")
        .get({ p: projectId, seq: seqOfRef(ref) }) as SignalDbRow | null;
      return row ? folded(row) : null;
    },
    open: (projectId) =>
      many(`SELECT s.* FROM project_signals s WHERE s.project_id = $p AND ${IS_OPEN} ORDER BY s.seq`, {
        p: projectId,
      }),
    closed: (projectId, limit) =>
      many(
        "SELECT s.* FROM project_signals s JOIN (SELECT e.signal_id, MIN(e.id) AS closed_by " +
          `FROM project_signal_events e WHERE ${FINAL} GROUP BY e.signal_id) c ON c.signal_id = s.id ` +
          "WHERE s.project_id = $p ORDER BY c.closed_by DESC LIMIT $limit",
        { p: projectId, limit },
      ),
    countByRun(runId) {
      const row = db.query("SELECT COUNT(*) AS n FROM project_signals WHERE run_id = $r").get({ r: runId });
      return (row as { n: number }).n;
    },
    duplicate: (runId, kind, title) =>
      db
        .query("SELECT 1 FROM project_signals WHERE run_id = $r AND kind = $kind AND title = $title LIMIT 1")
        .get({ r: runId, kind, title }) !== null,
    counts: () =>
      db
        .query(
          `SELECT s.project_id AS projectId, COUNT(*) AS open, SUM(CASE WHEN ${IS_UNREAD} THEN 1 ELSE 0 END) ` +
            `AS unread FROM project_signals s WHERE ${IS_OPEN} GROUP BY s.project_id ORDER BY s.project_id`,
        )
        .all() as ProjectSignalCount[],
    wakeup(projectId) {
      const row = db
        .query("SELECT * FROM project_agent_wakeups WHERE project_id = $p")
        .get({ p: projectId }) as WakeupRow | null;
      return row ? toWakeup(row) : { projectId, lastAt: null, dueAt: null };
    },
    saveWakeup(w) {
      db.query(
        "INSERT INTO project_agent_wakeups (project_id, last_at, due_at) VALUES ($p, $last_at, $due_at) " +
          "ON CONFLICT (project_id) DO UPDATE SET last_at = excluded.last_at, due_at = excluded.due_at",
      ).run({ p: w.projectId, last_at: w.lastAt, due_at: w.dueAt });
    },
    due: () =>
      (
        db
          .query("SELECT * FROM project_agent_wakeups WHERE due_at IS NOT NULL ORDER BY due_at, project_id")
          .all() as WakeupRow[]
      ).map(toWakeup),
    close: () => db.close(),
  };
}
