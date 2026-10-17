import type { Database } from "bun:sqlite";
import {
  KiboError,
  type ListProjectEventsInput,
  PROJECT_EVENTS_RETENTION,
  ProjectEvent,
  type ProjectEventInput,
  type ProjectEventPage,
} from "@kibo/schema";

export type EventStore = {
  append(projectId: string, input: ProjectEventInput): ProjectEvent;
  list(input: ListProjectEventsInput): ProjectEventPage;
  lastEventAt(projectId: string): ReadonlyMap<string, number>;
};

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS project_events (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, " +
    "at INTEGER NOT NULL, kind TEXT NOT NULL, ticket_id TEXT, feature_id TEXT, source TEXT NOT NULL, data TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS project_events_by_project ON project_events (project_id, id)",
  "CREATE TRIGGER IF NOT EXISTS project_events_no_update BEFORE UPDATE ON project_events " +
    "BEGIN SELECT RAISE(ABORT, 'append-only'); END",
];

type Row = {
  id: number;
  project_id: string;
  at: number;
  kind: string;
  ticket_id: string | null;
  feature_id: string | null;
  source: string;
  data: string;
};
type Bind = string | number | null;

function parseData(row: Row): unknown {
  try {
    return JSON.parse(row.data);
  } catch (e) {
    throw new KiboError(
      "STORE_CORRUPT",
      `project event ${row.id}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function toEvent(row: Row): ProjectEvent {
  const parsed = ProjectEvent.safeParse({
    id: row.id,
    projectId: row.project_id,
    at: row.at,
    kind: row.kind,
    ticketId: row.ticket_id,
    featureId: row.feature_id,
    source: row.source,
    data: parseData(row),
  });
  if (!parsed.success)
    throw new KiboError("STORE_CORRUPT", `project event ${row.id}: ${parsed.error.message}`);
  return parsed.data;
}

function listQuery(input: ListProjectEventsInput): { sql: string; params: Bind[] } {
  const where = ["project_id = ?"];
  const params: Bind[] = [input.projectId];
  if (input.before !== undefined) {
    where.push("id < ?");
    params.push(input.before);
  }
  if (input.ticketId !== undefined) {
    where.push("ticket_id = ?");
    params.push(input.ticketId);
  }
  if (input.featureId !== undefined) {
    where.push("feature_id = ?");
    params.push(input.featureId);
  }
  if (input.sources !== undefined && input.sources.length > 0) {
    where.push(`source IN (${input.sources.map(() => "?").join(", ")})`);
    params.push(...input.sources);
  }
  params.push(input.limit + 1);
  return {
    sql: `SELECT * FROM project_events WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`,
    params,
  };
}

export function createEventStore(db: Database, now: () => number): EventStore {
  for (const statement of SCHEMA) db.exec(statement);
  const insert = db.query<Row, Bind[]>(
    "INSERT INTO project_events (project_id, at, kind, ticket_id, feature_id, source, data) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
  );
  const trim = db.query<never, [string, string, number]>(
    "DELETE FROM project_events WHERE project_id = ? AND id <= " +
      "(SELECT id FROM project_events WHERE project_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?)",
  );
  const latest = db.query<{ ticket_id: string; at: number }, [string]>(
    "SELECT ticket_id, MAX(at) AS at FROM project_events WHERE project_id = ? AND ticket_id IS NOT NULL " +
      "GROUP BY ticket_id",
  );
  const lastAt = new Map<string, Map<string, number>>();

  const lastEventAt = (projectId: string): Map<string, number> => {
    const known = lastAt.get(projectId);
    if (known) return known;
    const loaded = new Map(latest.all(projectId).map((r) => [r.ticket_id, r.at]));
    lastAt.set(projectId, loaded);
    return loaded;
  };

  return {
    append(projectId, input) {
      const at = now();
      const { kind, ticketId, featureId, source, data } = input;
      const row = insert.get(projectId, at, kind, ticketId, featureId, source, JSON.stringify(data));
      if (!row) throw new KiboError("INTERNAL", "project event not stored");
      trim.run(projectId, projectId, PROJECT_EVENTS_RETENTION);
      if (ticketId !== null) lastEventAt(projectId).set(ticketId, at);
      return toEvent(row);
    },
    list(input) {
      const { sql, params } = listQuery(input);
      const rows = db.query<Row, Bind[]>(sql).all(...params);
      const items = rows.slice(0, input.limit).map(toEvent);
      return { items, nextBefore: rows.length > input.limit ? (items.at(-1)?.id ?? null) : null };
    },
    lastEventAt,
  };
}
