import type { Database } from "bun:sqlite";

export type ComponentEvent = {
  at: number;
  projectId: string;
  instanceId: string;
  ref: string;
  kind: string;
  code: string;
  count: number;
};
export type Refusal = Omit<ComponentEvent, "at" | "count">;
export type EventLog = {
  record(e: Refusal): void;
  list(limit?: number): ComponentEvent[];
  flush(): void;
};
export type EventLogLimits = { maxRows?: number; maxPerInstance?: number; burst?: number; windowMs?: number };

type Window = { first: Refusal; start: number; written: number; pending: number; lastAt: number };

export function ensureEventsTable(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS component_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, " +
      "project_id TEXT NOT NULL, instance_id TEXT NOT NULL, ref TEXT NOT NULL, kind TEXT NOT NULL, code TEXT NOT NULL, " +
      "count INTEGER NOT NULL DEFAULT 1)",
  );
  db.exec("CREATE INDEX IF NOT EXISTS component_events_instance ON component_events (instance_id, id)");
}

const keyOf = (e: Refusal) => JSON.stringify([e.instanceId, e.kind, e.code]);

export function createEventLog(
  db: Database,
  now: () => number = Date.now,
  limits: EventLogLimits = {},
): EventLog {
  const maxRows = limits.maxRows ?? 10_000;
  const maxPerInstance = limits.maxPerInstance ?? 1_000;
  const burst = limits.burst ?? 10;
  const windowMs = limits.windowMs ?? 60_000;
  const windows = new Map<string, Window>();

  const insert = db.query(
    "INSERT INTO component_events (at, project_id, instance_id, ref, kind, code, count) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const trimInstance = db.query(
    "DELETE FROM component_events WHERE instance_id = ?1 AND id <= " +
      "(SELECT id FROM component_events WHERE instance_id = ?1 ORDER BY id DESC LIMIT 1 OFFSET ?2)",
  );
  const trimAll = db.query(
    "DELETE FROM component_events WHERE id <= (SELECT id FROM component_events ORDER BY id DESC LIMIT 1 OFFSET ?)",
  );
  const select = db.query<ComponentEvent, [number]>(
    "SELECT at, project_id AS projectId, instance_id AS instanceId, ref, kind, code, count " +
      "FROM component_events ORDER BY id LIMIT ?",
  );

  const write = (e: ComponentEvent) => {
    insert.run(e.at, e.projectId, e.instanceId, e.ref, e.kind, e.code, e.count);
    trimInstance.run(e.instanceId, maxPerInstance);
    trimAll.run(maxRows);
  };
  const summarize = (w: Window) => {
    if (w.pending === 0) return;
    write({ ...w.first, at: w.lastAt, count: w.pending });
    w.pending = 0;
  };
  const closeExpired = (t: number) => {
    for (const [key, w] of windows) {
      if (t - w.start < windowMs) continue;
      summarize(w);
      windows.delete(key);
    }
  };
  const flushAll = db.transaction(() => {
    for (const w of windows.values()) summarize(w);
  });
  const append = db.transaction((e: Refusal, key: string, t: number) => {
    closeExpired(t);
    const w: Window = windows.get(key) ?? { first: e, start: t, written: 0, pending: 0, lastAt: t };
    windows.set(key, w);
    w.written += 1;
    write({ ...e, at: t, count: 1 });
  });

  return {
    record: (e) => {
      const t = now();
      const key = keyOf(e);
      const open = windows.get(key);
      if (open && t - open.start < windowMs && open.written >= burst) {
        open.pending += 1;
        open.lastAt = t;
        return;
      }
      append(e, key, t);
    },
    list: (limit = 1_000) => {
      flushAll();
      return select.all(limit);
    },
    flush: () => {
      flushAll();
    },
  };
}
