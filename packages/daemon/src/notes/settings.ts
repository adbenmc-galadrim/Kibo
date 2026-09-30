import type { Database } from "bun:sqlite";

export type ProjectSettings = {
  get(projectId: string, key: string): string | null;
  set(projectId: string, key: string, value: string): void;
  unset(projectId: string, key: string): void;
  remove(projectId: string): void;
};

type Key = { projectId: string; key: string };

export function ensureSettingsTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS project_settings (project_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (project_id, key))",
  );
}

export function createProjectSettings(db: Database): ProjectSettings {
  const select = db.query<{ value: string }, Key>(
    "SELECT value FROM project_settings WHERE project_id = $projectId AND key = $key",
  );
  const upsert = db.query<never, Key & { value: string }>(
    "INSERT INTO project_settings (project_id, key, value) VALUES ($projectId, $key, $value) " +
      "ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value",
  );
  const remove = db.query<never, Key>(
    "DELETE FROM project_settings WHERE project_id = $projectId AND key = $key",
  );
  const removeProject = db.query<never, { projectId: string }>(
    "DELETE FROM project_settings WHERE project_id = $projectId",
  );
  return {
    get: (projectId, key) => select.get({ projectId, key })?.value ?? null,
    set: (projectId, key, value) => {
      upsert.run({ projectId, key, value });
    },
    unset: (projectId, key) => {
      remove.run({ projectId, key });
    },
    remove: (projectId) => {
      removeProject.run({ projectId });
    },
  };
}
