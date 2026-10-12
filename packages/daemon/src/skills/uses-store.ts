import type { Database } from "bun:sqlite";
import { type RunAction, SkillId, type SkillUsage } from "@kibo/schema";
import { immediateTransaction } from "../sqlite-busy";

export type SkillUses = {
  record(runId: string, actions: readonly RunAction[], at: number): void;
  byRun(runId: string): { skillId: SkillId; count: number }[];
  usage(skillId: SkillId, since: number): SkillUsage;
  close(): void;
};

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS run_skill_uses (run_id TEXT NOT NULL, skill_id TEXT NOT NULL, " +
    "count INTEGER NOT NULL, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY (run_id, skill_id))",
  "CREATE INDEX IF NOT EXISTS run_skill_uses_by_skill ON run_skill_uses (skill_id, last_at)",
  "CREATE TABLE IF NOT EXISTS run_skill_calls (run_id TEXT NOT NULL, call_id TEXT NOT NULL, " +
    "PRIMARY KEY (run_id, call_id))",
];

type LastRow = { run_id: string; last_at: number };

const skillOf = (action: RunAction): SkillId | null =>
  action.kind === "skill" && action.outcome !== "denied" && SkillId.safeParse(action.target).success
    ? action.target
    : null;

export function createSkillUses(db: Database): SkillUses {
  for (const sql of SCHEMA) db.exec(sql);
  const seen = db.query("INSERT OR IGNORE INTO run_skill_calls (run_id, call_id) VALUES ($run, $call)");
  const upsert = db.query(
    "INSERT INTO run_skill_uses (run_id, skill_id, count, first_at, last_at) VALUES ($run, $skill, 1, $at, $at) " +
      "ON CONFLICT (run_id, skill_id) DO UPDATE SET count = count + 1, last_at = MAX(last_at, excluded.last_at)",
  );
  const byRun = db.query(
    "SELECT skill_id AS skillId, count FROM run_skill_uses WHERE run_id = $run ORDER BY first_at, skill_id",
  );
  const last = db.query(
    "SELECT run_id, last_at FROM run_skill_uses WHERE skill_id = $skill ORDER BY last_at DESC, run_id LIMIT 1",
  );
  const recent = db.query(
    "SELECT COUNT(*) AS n FROM run_skill_uses WHERE skill_id = $skill AND last_at >= $since",
  );
  const hasRuns = () =>
    db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'runs'").get() !== null;
  const ticketKeyOf = (runId: string): string | null => {
    if (!hasRuns()) return null;
    const row = db.query("SELECT ticket_key FROM runs WHERE id = $id").get({ id: runId });
    const key: unknown = row === null ? null : Reflect.get(Object(row), "ticket_key");
    return typeof key === "string" ? key : null;
  };

  const record = immediateTransaction(db, (runId: string, actions: readonly RunAction[], at: number) => {
    for (const action of actions) {
      const skill = skillOf(action);
      if (skill === null) continue;
      if (action.callId !== undefined && seen.run({ run: runId, call: action.callId }).changes === 0)
        continue;
      upsert.run({ run: runId, skill, at });
    }
  });

  return {
    record: (runId, actions, at) => record(runId, actions, at),
    byRun: (runId) => byRun.all({ run: runId }) as { skillId: SkillId; count: number }[],
    usage(skillId, since) {
      const row = last.get({ skill: skillId }) as LastRow | null;
      const { n } = recent.get({ skill: skillId, since }) as { n: number };
      return {
        last:
          row === null ? null : { runId: row.run_id, ticketKey: ticketKeyOf(row.run_id), at: row.last_at },
        runs30d: n,
      };
    },
    close: () => db.close(),
  };
}
