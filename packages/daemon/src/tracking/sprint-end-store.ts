import type { Database } from "bun:sqlite";

export type SprintEndStore = {
  has(sprintId: string): boolean;
  mark(projectId: string, sprintId: string): void;
};

export function createSprintEndStore(db: Database, now: () => number): SprintEndStore {
  db.exec(
    "CREATE TABLE IF NOT EXISTS sprint_ends (project_id TEXT NOT NULL, sprint_id TEXT PRIMARY KEY, " +
      "notified_at INTEGER NOT NULL)",
  );
  const exists = db.query<{ found: number }, { sprintId: string }>(
    "SELECT 1 AS found FROM sprint_ends WHERE sprint_id = $sprintId",
  );
  const insert = db.query<never, { projectId: string; sprintId: string; at: number }>(
    "INSERT OR IGNORE INTO sprint_ends (project_id, sprint_id, notified_at) VALUES ($projectId, $sprintId, $at)",
  );
  return {
    has: (sprintId) => exists.get({ sprintId }) !== null,
    mark(projectId, sprintId) {
      insert.run({ projectId, sprintId, at: now() });
    },
  };
}
