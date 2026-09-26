import type { Database } from "bun:sqlite";

export type ComponentEvent = {
  at: number;
  projectId: string;
  instanceId: string;
  ref: string;
  kind: string;
  code: string;
};
export type EventLog = {
  record(e: Omit<ComponentEvent, "at">): void;
  list(limit?: number): ComponentEvent[];
};
export type EventLogLimits = { maxRows?: number; maxPerInstance?: number };

export function ensureEventsTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS component_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, " +
      "project_id TEXT NOT NULL, instance_id TEXT NOT NULL, ref TEXT NOT NULL, kind TEXT NOT NULL, code TEXT NOT NULL)",
  );
  db.exec("CREATE INDEX IF NOT EXISTS component_events_instance ON component_events (instance_id, id)");
}

export function createEventLog(
  db: Database,
  now: () => number = Date.now,
  limits: EventLogLimits = {},
): EventLog {
  const maxRows = limits.maxRows ?? 10_000;
  const maxPerInstance = limits.maxPerInstance ?? 1_000;
  const insert = db.query(
    "INSERT INTO component_events (at, project_id, instance_id, ref, kind, code) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const trimInstance = db.query(
    "DELETE FROM component_events WHERE instance_id = ?1 AND id <= " +
      "(SELECT id FROM component_events WHERE instance_id = ?1 ORDER BY id DESC LIMIT 1 OFFSET ?2)",
  );
  const trimAll = db.query(
    "DELETE FROM component_events WHERE id <= (SELECT id FROM component_events ORDER BY id DESC LIMIT 1 OFFSET ?)",
  );
  const select = db.query<ComponentEvent, [number]>(
    "SELECT at, project_id AS projectId, instance_id AS instanceId, ref, kind, code FROM component_events ORDER BY id LIMIT ?",
  );
  const append = db.transaction((e: ComponentEvent) => {
    insert.run(e.at, e.projectId, e.instanceId, e.ref, e.kind, e.code);
    trimInstance.run(e.instanceId, maxPerInstance);
    trimAll.run(maxRows);
  });
  return {
    record: (e) => {
      append({ ...e, at: now() });
    },
    list: (limit = 1_000) => select.all(limit),
  };
}
