import type { Database } from "bun:sqlite";
import { MemberRole } from "@kibo/schema";

export type SyncConfig = {
  serverUrl: string;
  caFile: string | null;
  userId: string;
  deviceId: string;
  displayName: string;
};
export type SyncProjectRow = {
  projectId: string;
  enabled: boolean;
  role: MemberRole;
  lastServerVersion: Uint8Array | null;
  lastSyncAt: number | null;
  lastError: string | null;
  accessRevoked: boolean;
};
export type SyncDb = {
  config(): SyncConfig | null;
  setConfig(config: SyncConfig | null): void;
  project(projectId: string): SyncProjectRow | null;
  upsertProject(row: SyncProjectRow): void;
  removeProject(projectId: string): void;
  projects(): SyncProjectRow[];
};

type ProjectRecord = {
  projectId: string;
  enabled: number;
  role: string;
  lastServerVersion: Uint8Array | null;
  lastSyncAt: number | null;
  lastError: string | null;
  accessRevoked: number;
};

const toRow = (r: ProjectRecord): SyncProjectRow => ({
  projectId: r.projectId,
  enabled: r.enabled === 1,
  role: MemberRole.parse(r.role),
  lastServerVersion: r.lastServerVersion ? new Uint8Array(r.lastServerVersion) : null,
  lastSyncAt: r.lastSyncAt,
  lastError: r.lastError,
  accessRevoked: r.accessRevoked === 1,
});

export function openSyncDb(db: Database): SyncDb {
  db.exec(
    "CREATE TABLE IF NOT EXISTS sync_config (id INTEGER PRIMARY KEY CHECK (id = 1), serverUrl TEXT NOT NULL, " +
      "caFile TEXT, userId TEXT NOT NULL, deviceId TEXT NOT NULL, displayName TEXT NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS sync_projects (projectId TEXT PRIMARY KEY, enabled INTEGER NOT NULL, " +
      "role TEXT NOT NULL, lastServerVersion BLOB, lastSyncAt INTEGER, lastError TEXT, accessRevoked INTEGER NOT NULL)",
  );
  const selectConfig = db.query<SyncConfig, []>(
    "SELECT serverUrl, caFile, userId, deviceId, displayName FROM sync_config WHERE id = 1",
  );
  const insertConfig = db.query<null, Record<string, string | null>>(
    "INSERT INTO sync_config (id, serverUrl, caFile, userId, deviceId, displayName) " +
      "VALUES (1, $serverUrl, $caFile, $userId, $deviceId, $displayName)",
  );
  const selectProject = db.query<ProjectRecord, { projectId: string }>(
    "SELECT * FROM sync_projects WHERE projectId = $projectId",
  );
  const selectProjects = db.query<ProjectRecord, []>("SELECT * FROM sync_projects ORDER BY projectId");
  const upsert = db.query<null, Record<string, string | number | Uint8Array | null>>(
    "INSERT INTO sync_projects VALUES ($projectId, $enabled, $role, $lastServerVersion, $lastSyncAt, " +
      "$lastError, $accessRevoked) ON CONFLICT(projectId) DO UPDATE SET enabled = excluded.enabled, " +
      "role = excluded.role, lastServerVersion = excluded.lastServerVersion, lastSyncAt = excluded.lastSyncAt, " +
      "lastError = excluded.lastError, accessRevoked = excluded.accessRevoked",
  );
  const remove = db.query<null, { projectId: string }>(
    "DELETE FROM sync_projects WHERE projectId = $projectId",
  );
  return {
    config: () => selectConfig.get() ?? null,
    setConfig: (config) => {
      db.transaction(() => {
        db.exec("DELETE FROM sync_config");
        if (!config) return;
        insertConfig.run({
          serverUrl: config.serverUrl,
          caFile: config.caFile,
          userId: config.userId,
          deviceId: config.deviceId,
          displayName: config.displayName,
        });
      })();
    },
    project: (projectId) => {
      const r = selectProject.get({ projectId: projectId });
      return r ? toRow(r) : null;
    },
    upsertProject: (row) => {
      upsert.run({
        projectId: row.projectId,
        enabled: row.enabled ? 1 : 0,
        role: row.role,
        lastServerVersion: row.lastServerVersion,
        lastSyncAt: row.lastSyncAt,
        lastError: row.lastError,
        accessRevoked: row.accessRevoked ? 1 : 0,
      });
    },
    removeProject: (projectId) => {
      remove.run({ projectId: projectId });
    },
    projects: () => selectProjects.all().map(toRow),
  };
}
