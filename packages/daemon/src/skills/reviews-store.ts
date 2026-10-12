import { randomUUID } from "node:crypto";
import {
  Actor,
  foldSkillReview,
  KiboError,
  type SkillId,
  type SkillReview,
  type SkillReviewEvent,
  type SkillReviewRow,
  SkillVerdict,
} from "@kibo/schema";
import { z } from "zod";
import { immediateTransaction } from "../sqlite-busy";
import { openRunsDatabase } from "./runs-db";

export type SkillReviewStore = {
  create(row: Omit<SkillReviewRow, "id">): SkillReview;
  appendEvent(id: string, event: SkillReviewEvent): SkillReview;
  byRun(runId: string): SkillReview[];
  bySkill(skillId: SkillId): SkillReview[];
  openCount(skillId: SkillId): number;
  get(id: string): SkillReview | null;
  replaceOpen(runId: string, skillId: SkillId, at: number): void;
  close(): void;
};

const APPEND_ONLY = ["skill_reviews", "skill_review_events"];
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS skill_reviews (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, run_label TEXT NOT NULL, " +
    "agent_name TEXT NOT NULL, project_id TEXT, ticket_id TEXT, ticket_key TEXT, skill_id TEXT NOT NULL, " +
    "skill_path TEXT, base_hash TEXT, verdict TEXT NOT NULL, note TEXT NOT NULL, suggestion TEXT, " +
    "created_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS skill_reviews_by_run ON skill_reviews (run_id, created_at)",
  "CREATE INDEX IF NOT EXISTS skill_reviews_by_skill ON skill_reviews (skill_id, created_at)",
  "CREATE TABLE IF NOT EXISTS skill_review_events (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "review_id TEXT NOT NULL REFERENCES skill_reviews(id), type TEXT NOT NULL, by TEXT, at INTEGER NOT NULL, " +
    "version_id TEXT)",
  "CREATE INDEX IF NOT EXISTS skill_review_events_by_review ON skill_review_events (review_id, id)",
  ...APPEND_ONLY.flatMap((t) => [
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
    `CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
  ]),
];
const IS_OPEN = "NOT EXISTS (SELECT 1 FROM skill_review_events e WHERE e.review_id = r.id)";

type ReviewDbRow = {
  id: string;
  run_id: string;
  run_label: string;
  agent_name: string;
  project_id: string | null;
  ticket_id: string | null;
  ticket_key: string | null;
  skill_id: string;
  skill_path: string | null;
  base_hash: string | null;
  verdict: string;
  note: string;
  suggestion: string | null;
  created_at: number;
};
type EventDbRow = { id: number; type: string; by: string | null; at: number; version_id: string | null };

const EventType = z.enum(["integrated", "ignored", "replaced"]);

function stored<T>(parse: () => T, what: string): T {
  try {
    return parse();
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `${what}: ${String(e)}`);
  }
}

const toRow = (r: ReviewDbRow): SkillReviewRow => ({
  id: r.id,
  runId: r.run_id,
  runLabel: r.run_label,
  agentName: r.agent_name,
  projectId: r.project_id,
  ticketId: r.ticket_id,
  ticketKey: r.ticket_key,
  skillId: r.skill_id,
  skillPath: r.skill_path,
  baseHash: r.base_hash,
  verdict: stored(() => SkillVerdict.parse(r.verdict), `skill review ${r.id} verdict`),
  note: r.note,
  suggestion: r.suggestion,
  createdAt: r.created_at,
});

const toEvent = (r: EventDbRow): SkillReviewEvent => ({
  type: stored(() => EventType.parse(r.type), `skill review event ${r.id}`),
  by: r.by === null ? null : stored(() => Actor.parse(JSON.parse(r.by ?? "")), `skill review event ${r.id}`),
  at: r.at,
  versionId: r.version_id,
});

export function openSkillReviewStore(home: string): SkillReviewStore {
  const db = openRunsDatabase(home, "skill review");
  try {
    for (const sql of SCHEMA) db.exec(sql);
  } catch (e) {
    db.close();
    throw new KiboError("STORE_CORRUPT", `cannot create the skill review tables: ${String(e)}`);
  }
  const byId = db.query("SELECT * FROM skill_reviews WHERE id = $id");
  const eventsOf = db.query(
    "SELECT id, type, by, at, version_id FROM skill_review_events WHERE review_id = $id ORDER BY id",
  );
  const insert = db.query(
    "INSERT INTO skill_reviews (id, run_id, run_label, agent_name, project_id, ticket_id, ticket_key, skill_id, " +
      "skill_path, base_hash, verdict, note, suggestion, created_at) VALUES ($id, $run_id, $run_label, $agent_name, " +
      "$project_id, $ticket_id, $ticket_key, $skill_id, $skill_path, $base_hash, $verdict, $note, $suggestion, " +
      "$created_at)",
  );
  const insertEvent = db.query(
    "INSERT INTO skill_review_events (review_id, type, by, at, version_id) VALUES ($id, $type, $by, $at, $version)",
  );

  const folded = (row: ReviewDbRow): SkillReview =>
    foldSkillReview(toRow(row), (eventsOf.all({ id: row.id }) as EventDbRow[]).map(toEvent));
  const get = (id: string): SkillReview | null => {
    const row = byId.get({ id }) as ReviewDbRow | null;
    return row ? folded(row) : null;
  };
  const many = (sql: string, params: Record<string, string>): SkillReview[] =>
    (db.query(sql).all(params) as ReviewDbRow[]).map(folded);
  const addEvent = (id: string, event: SkillReviewEvent) =>
    insertEvent.run({
      id,
      type: event.type,
      by: event.by === null ? null : JSON.stringify(event.by),
      at: event.at,
      version: event.versionId,
    });

  const create = immediateTransaction(db, (row: Omit<SkillReviewRow, "id">): SkillReview => {
    const id = randomUUID();
    insert.run({
      id,
      run_id: row.runId,
      run_label: row.runLabel,
      agent_name: row.agentName,
      project_id: row.projectId,
      ticket_id: row.ticketId,
      ticket_key: row.ticketKey,
      skill_id: row.skillId,
      skill_path: row.skillPath,
      base_hash: row.baseHash,
      verdict: row.verdict,
      note: row.note,
      suggestion: row.suggestion,
      created_at: row.createdAt,
    });
    return foldSkillReview({ ...row, id }, []);
  });
  const appendEvent = immediateTransaction(db, (id: string, event: SkillReviewEvent): SkillReview => {
    const review = get(id);
    if (!review) throw new KiboError("NOT_FOUND", `skill review ${id} not found`);
    if (review.status !== "new") return review;
    addEvent(id, event);
    return get(id) ?? review;
  });
  const replaceOpen = immediateTransaction(db, (runId: string, skillId: SkillId, at: number) => {
    const open = many(
      `SELECT r.* FROM skill_reviews r WHERE r.run_id = $run AND r.skill_id = $skill AND ${IS_OPEN}`,
      { run: runId, skill: skillId },
    );
    for (const review of open) addEvent(review.id, { type: "replaced", by: null, at, versionId: null });
  });

  return {
    create: (row) => create(row),
    appendEvent: (id, event) => appendEvent(id, event),
    byRun: (runId) =>
      many("SELECT * FROM skill_reviews WHERE run_id = $run ORDER BY created_at, rowid", { run: runId }),
    bySkill: (skillId) =>
      many("SELECT * FROM skill_reviews WHERE skill_id = $skill ORDER BY created_at DESC, rowid DESC", {
        skill: skillId,
      }),
    openCount(skillId) {
      const row = db
        .query(`SELECT COUNT(*) AS n FROM skill_reviews r WHERE r.skill_id = $skill AND ${IS_OPEN}`)
        .get({ skill: skillId });
      return (row as { n: number }).n;
    },
    get,
    replaceOpen: (runId, skillId, at) => replaceOpen(runId, skillId, at),
    close: () => db.close(),
  };
}
