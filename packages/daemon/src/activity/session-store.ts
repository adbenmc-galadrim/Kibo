import type { Database } from "bun:sqlite";
import { activeSessions, isSessionAlive, type SessionRow, type TicketSession } from "@kibo/schema";

export type ProjectSessionRow = SessionRow & { projectId: string };
export type ClosedSession = ProjectSessionRow & { durationMs: number };

export type SessionStore = {
  start(projectId: string, ticketId: string, tool: string, now: number): ProjectSessionRow;
  ping(projectId: string, ticketId: string, now: number): ProjectSessionRow | null;
  stop(projectId: string, ticketId: string, now: number): ClosedSession | null;
  active(projectId: string, now: number): Map<string, TicketSession>;
  sweep(now: number): ClosedSession[];
};

type DbRow = {
  project_id: string;
  ticket_id: string;
  tool: string;
  started_at: number;
  last_seen_at: number;
};

const toRow = (r: DbRow): ProjectSessionRow => ({
  projectId: r.project_id,
  ticketId: r.ticket_id,
  tool: r.tool,
  startedAt: r.started_at,
  lastSeenAt: r.last_seen_at,
});

const closedAt = (row: ProjectSessionRow, end: number): ClosedSession => ({
  ...row,
  durationMs: Math.max(0, end - row.startedAt),
});

export function createSessionStore(db: Database): SessionStore {
  db.exec(
    "CREATE TABLE IF NOT EXISTS ticket_sessions (project_id TEXT NOT NULL, ticket_id TEXT PRIMARY KEY, " +
      "tool TEXT NOT NULL, started_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)",
  );
  const one = db.query<DbRow, { projectId: string; ticketId: string }>(
    "SELECT * FROM ticket_sessions WHERE project_id = $projectId AND ticket_id = $ticketId",
  );
  const ofProject = db.query<DbRow, { projectId: string }>(
    "SELECT * FROM ticket_sessions WHERE project_id = $projectId ORDER BY ticket_id",
  );
  const all = db.query<DbRow, []>("SELECT * FROM ticket_sessions ORDER BY project_id, ticket_id");
  const upsert = db.query<never, DbRow>(
    "INSERT OR REPLACE INTO ticket_sessions (project_id, ticket_id, tool, started_at, last_seen_at) " +
      "VALUES ($project_id, $ticket_id, $tool, $started_at, $last_seen_at)",
  );
  const touch = db.query<never, { ticketId: string; now: number }>(
    "UPDATE ticket_sessions SET last_seen_at = $now WHERE ticket_id = $ticketId",
  );
  const remove = db.query<never, { ticketId: string }>(
    "DELETE FROM ticket_sessions WHERE ticket_id = $ticketId",
  );

  const find = (projectId: string, ticketId: string): ProjectSessionRow | null => {
    const row = one.get({ projectId, ticketId });
    return row === null ? null : toRow(row);
  };
  const ping = (projectId: string, ticketId: string, now: number): ProjectSessionRow | null => {
    const row = find(projectId, ticketId);
    if (row === null || !isSessionAlive(row, now)) return null;
    touch.run({ ticketId, now });
    return { ...row, lastSeenAt: now };
  };

  return {
    start(projectId, ticketId, tool, now) {
      const alive = ping(projectId, ticketId, now);
      if (alive !== null) return alive;
      upsert.run({ project_id: projectId, ticket_id: ticketId, tool, started_at: now, last_seen_at: now });
      return { projectId, ticketId, tool, startedAt: now, lastSeenAt: now };
    },
    ping,
    stop(projectId, ticketId, now) {
      const row = find(projectId, ticketId);
      if (row === null) return null;
      remove.run({ ticketId });
      return closedAt(row, now);
    },
    active(projectId, now) {
      return activeSessions(ofProject.all({ projectId }).map(toRow), now);
    },
    sweep(now) {
      const silent = all
        .all()
        .map(toRow)
        .filter((row) => !isSessionAlive(row, now));
      db.transaction(() => {
        for (const row of silent) remove.run({ ticketId: row.ticketId });
      })();
      return silent.map((row) => closedAt(row, row.lastSeenAt));
    },
  };
}
