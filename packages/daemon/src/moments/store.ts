import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KiboError, MomentData, type MomentKind, PartialReason, type RunMoment, Step } from "@kibo/schema";
import { z } from "zod";
import { immediateTransaction, SQLITE_BUSY_TIMEOUT_MS } from "../sqlite-busy";

export type TraceSource = "pending" | "transcript" | "hooks";
export type RunTrace = {
  runId: string;
  path: string | null;
  offset: number;
  source: TraceSource;
  partial: PartialReason | null;
  doingStep: string | null;
  baseHead: string | null;
  closedAt: number | null;
};
export type MomentStore = {
  append(runId: string, data: MomentData, stepId: string | null, at: number): RunMoment;
  list(runId: string, after?: number): RunMoment[];
  lastOfKind(runId: string, kind: MomentKind): RunMoment | null;
  trace(runId: string): RunTrace | null;
  saveTrace(trace: RunTrace): void;
  internalPlan(runId: string): Step[] | null;
  saveInternalPlan(runId: string, plan: Step[], at: number): void;
  close(): void;
};

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS run_moments (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, " +
    "seq INTEGER NOT NULL, at INTEGER NOT NULL, step_id TEXT, kind TEXT NOT NULL, data TEXT NOT NULL, " +
    "UNIQUE (run_id, seq))",
  "CREATE INDEX IF NOT EXISTS run_moments_by_run ON run_moments (run_id, seq)",
  "CREATE TRIGGER IF NOT EXISTS run_moments_no_update BEFORE UPDATE ON run_moments " +
    "BEGIN SELECT RAISE(ABORT, 'append-only'); END",
  "CREATE TRIGGER IF NOT EXISTS run_moments_no_delete BEFORE DELETE ON run_moments " +
    "BEGIN SELECT RAISE(ABORT, 'append-only'); END",
  "CREATE TABLE IF NOT EXISTS run_traces (run_id TEXT PRIMARY KEY, path TEXT, offset INTEGER NOT NULL, " +
    "source TEXT NOT NULL, partial TEXT, doing_step TEXT, base_head TEXT, closed_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS run_internal_plans (run_id TEXT PRIMARY KEY, plan TEXT NOT NULL, at INTEGER NOT NULL)",
];

type MomentRow = {
  id: number;
  run_id: string;
  seq: number;
  at: number;
  step_id: string | null;
  data: string;
};
type TraceRow = {
  run_id: string;
  path: string | null;
  offset: number;
  source: string;
  partial: string | null;
  doing_step: string | null;
  base_head: string | null;
  closed_at: number | null;
};

const Source = z.enum(["pending", "transcript", "hooks"]);
const Plan = z.array(Step);

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

function storedEnum<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `${what}: ${parsed.error.message}`);
  return parsed.data;
}

const toMoment = (r: MomentRow): RunMoment => ({
  id: r.id,
  runId: r.run_id,
  seq: r.seq,
  at: r.at,
  stepId: r.step_id,
  data: parseStored(MomentData, r.data, `moment ${r.id}`),
});

const toTrace = (r: TraceRow): RunTrace => ({
  runId: r.run_id,
  path: r.path,
  offset: r.offset,
  source: storedEnum(Source, r.source, `trace ${r.run_id} source`),
  partial: r.partial === null ? null : storedEnum(PartialReason, r.partial, `trace ${r.run_id} partial`),
  doingStep: r.doing_step,
  baseHead: r.base_head,
  closedAt: r.closed_at,
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
    throw new KiboError("STORE_CORRUPT", `cannot open the moment tables in ${file}: ${String(e)}`);
  }
}

function validMoment(data: MomentData): MomentData {
  const parsed = MomentData.safeParse(data);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `moment: ${parsed.error.message}`);
  return parsed.data;
}

export function openMomentStore(home: string): MomentStore {
  const db = openDatabase(home);
  const nextSeq = db.query("SELECT COALESCE(MAX(seq) + 1, 0) AS seq FROM run_moments WHERE run_id = $run_id");
  const insert = db.query(
    "INSERT INTO run_moments (run_id, seq, at, step_id, kind, data) " +
      "VALUES ($run_id, $seq, $at, $step_id, $kind, $data) RETURNING *",
  );
  const after = db.query("SELECT * FROM run_moments WHERE run_id = $run_id AND seq > $after ORDER BY seq");
  const lastOf = db.query(
    "SELECT * FROM run_moments WHERE run_id = $run_id AND kind = $kind ORDER BY seq DESC LIMIT 1",
  );
  const traceOf = db.query("SELECT * FROM run_traces WHERE run_id = $run_id");
  const upsertTrace = db.query(
    "INSERT INTO run_traces (run_id, path, offset, source, partial, doing_step, base_head, closed_at) " +
      "VALUES ($run_id, $path, $offset, $source, $partial, $doing_step, $base_head, $closed_at) " +
      "ON CONFLICT (run_id) DO UPDATE SET path = excluded.path, offset = excluded.offset, " +
      "source = excluded.source, partial = excluded.partial, doing_step = excluded.doing_step, " +
      "base_head = excluded.base_head, closed_at = excluded.closed_at",
  );
  const planOf = db.query("SELECT plan FROM run_internal_plans WHERE run_id = $run_id");
  const upsertPlan = db.query(
    "INSERT INTO run_internal_plans (run_id, plan, at) VALUES ($run_id, $plan, $at) " +
      "ON CONFLICT (run_id) DO UPDATE SET plan = excluded.plan, at = excluded.at",
  );

  const append = immediateTransaction(
    db,
    (runId: string, data: MomentData, stepId: string | null, at: number): RunMoment => {
      const { seq } = nextSeq.get({ run_id: runId }) as { seq: number };
      const row = insert.get({
        run_id: runId,
        seq,
        at,
        step_id: stepId,
        kind: data.kind,
        data: JSON.stringify(data),
      }) as MomentRow;
      return toMoment(row);
    },
  );

  return {
    append: (runId, data, stepId, at) => append(runId, validMoment(data), stepId, at),
    list: (runId, afterSeq = -1) =>
      (after.all({ run_id: runId, after: afterSeq }) as MomentRow[]).map(toMoment),
    lastOfKind(runId, kind) {
      const row = lastOf.get({ run_id: runId, kind }) as MomentRow | null;
      return row ? toMoment(row) : null;
    },
    trace(runId) {
      const row = traceOf.get({ run_id: runId }) as TraceRow | null;
      return row ? toTrace(row) : null;
    },
    saveTrace(t) {
      upsertTrace.run({
        run_id: t.runId,
        path: t.path,
        offset: t.offset,
        source: t.source,
        partial: t.partial,
        doing_step: t.doingStep,
        base_head: t.baseHead,
        closed_at: t.closedAt,
      });
    },
    internalPlan(runId) {
      const row = planOf.get({ run_id: runId }) as { plan: string } | null;
      return row ? parseStored(Plan, row.plan, `internal plan of ${runId}`) : null;
    },
    saveInternalPlan(runId, plan, at) {
      upsertPlan.run({ run_id: runId, plan: JSON.stringify(plan), at });
    },
    close: () => db.close(),
  };
}
