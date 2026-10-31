import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KiboError, type Wakeup } from "@kibo/schema";
import { SQLITE_BUSY_TIMEOUT_MS } from "../../sqlite-busy";

export type WakeupStore = {
  wakeup(projectId: string): Wakeup;
  saveWakeup(w: Wakeup): void;
  due(): Wakeup[];
  queueAnswer(projectId: string, questionId: string, at: number): void;
  queuedAnswers(projectId: string): string[];
  dropAnswers(projectId: string): void;
  close(): void;
};

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS project_agent_wakeups (project_id TEXT PRIMARY KEY, last_at INTEGER, due_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS project_agent_wakeup_answers (project_id TEXT NOT NULL, question_id TEXT NOT NULL, " +
    "queued_at INTEGER NOT NULL, PRIMARY KEY (project_id, question_id))",
];

type WakeupRow = { project_id: string; last_at: number | null; due_at: number | null };

const toWakeup = (r: WakeupRow): Wakeup => ({ projectId: r.project_id, lastAt: r.last_at, dueAt: r.due_at });

function openDatabase(home: string): Database {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const file = join(home, "runs.db");
  try {
    const db = new Database(file, { create: true, strict: true });
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = FULL");
    for (const sql of SCHEMA) db.exec(sql);
    for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) chmodSync(f, 0o600);
    return db;
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot open the wake-up tables in ${file}: ${String(e)}`);
  }
}

export function openWakeupStore(home: string): WakeupStore {
  const db = openDatabase(home);
  return {
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
    queueAnswer(projectId, questionId, at) {
      db.query(
        "INSERT INTO project_agent_wakeup_answers (project_id, question_id, queued_at) VALUES ($p, $q, $at) " +
          "ON CONFLICT (project_id, question_id) DO NOTHING",
      ).run({ p: projectId, q: questionId, at });
    },
    queuedAnswers: (projectId) =>
      (
        db
          .query(
            "SELECT question_id FROM project_agent_wakeup_answers WHERE project_id = $p " +
              "ORDER BY queued_at, question_id",
          )
          .all({ p: projectId }) as { question_id: string }[]
      ).map((r) => r.question_id),
    dropAnswers(projectId) {
      db.query("DELETE FROM project_agent_wakeup_answers WHERE project_id = $p").run({ p: projectId });
    },
    close: () => db.close(),
  };
}
