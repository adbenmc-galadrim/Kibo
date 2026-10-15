import type { Database } from "bun:sqlite";
import {
  foldSubagent,
  KiboError,
  type RunSubagent,
  type SubagentEvent,
  type SubagentRow,
  type SubagentTraceFacts,
} from "@kibo/schema";
import { z } from "zod";
import { openRunsDatabase } from "../skills/runs-db";

export type SubagentTrace = {
  subagentId: string;
  runId: string;
  path: string;
  offset: number;
  closedAt: number | null;
};
export type SubagentFactsOf = (runId: string, subagentId: string) => SubagentTraceFacts;
export type SubagentStore = {
  create(row: SubagentRow): void;
  get(id: string): SubagentRow | null;
  append(id: string, event: SubagentEvent): void;
  events(id: string): SubagentEvent[];
  byToolUse(runId: string, toolUseId: string): string | null;
  find(id: string): RunSubagent | null;
  list(runId: string): RunSubagent[];
  trace(id: string): SubagentTrace | null;
  saveTrace(trace: SubagentTrace): void;
  close(): void;
};

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS run_subagents (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, tool_use_id TEXT, " +
    "type TEXT NOT NULL, description TEXT NOT NULL, prompt TEXT NOT NULL, model TEXT, parent_id TEXT, " +
    "transcript_path TEXT, started_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS run_subagents_by_run ON run_subagents (run_id, started_at)",
  "CREATE TRIGGER IF NOT EXISTS run_subagents_no_update BEFORE UPDATE ON run_subagents " +
    "BEGIN SELECT RAISE(ABORT, 'frozen'); END",
  "CREATE TRIGGER IF NOT EXISTS run_subagents_no_delete BEFORE DELETE ON run_subagents " +
    "BEGIN SELECT RAISE(ABORT, 'frozen'); END",
  "CREATE TABLE IF NOT EXISTS run_subagent_events (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "subagent_id TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS run_subagent_events_by_subagent ON run_subagent_events (subagent_id, id)",
  "CREATE TRIGGER IF NOT EXISTS run_subagent_events_no_update BEFORE UPDATE ON run_subagent_events " +
    "BEGIN SELECT RAISE(ABORT, 'append-only'); END",
  "CREATE TRIGGER IF NOT EXISTS run_subagent_events_no_delete BEFORE DELETE ON run_subagent_events " +
    "BEGIN SELECT RAISE(ABORT, 'append-only'); END",
  "CREATE TABLE IF NOT EXISTS run_subagent_traces (subagent_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, " +
    "path TEXT NOT NULL, offset INTEGER NOT NULL, closed_at INTEGER)",
];

type Row = {
  id: string;
  run_id: string;
  tool_use_id: string | null;
  type: string;
  description: string;
  prompt: string;
  model: string | null;
  parent_id: string | null;
  transcript_path: string | null;
  started_at: number;
};
type EventRow = { type: string; data: string; at: number };
type TraceRow = {
  subagent_id: string;
  run_id: string;
  path: string;
  offset: number;
  closed_at: number | null;
};

const Facts = z
  .object({
    toolUseId: z.string(),
    type: z.string(),
    description: z.string(),
    prompt: z.string(),
    model: z.string(),
    parentId: z.string(),
    transcriptPath: z.string(),
  })
  .partial()
  .strict();
const EventData = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started") }),
  z.object({ type: z.literal("linked"), facts: Facts }),
  z.object({ type: z.literal("ended"), isError: z.boolean(), result: z.string().nullable() }),
]);

const NO_FACTS: SubagentFactsOf = () => ({ actions: 0, lastText: null });

const toRow = (r: Row): SubagentRow => ({
  id: r.id,
  runId: r.run_id,
  toolUseId: r.tool_use_id,
  type: r.type,
  description: r.description,
  prompt: r.prompt,
  model: r.model,
  parentId: r.parent_id,
  transcriptPath: r.transcript_path,
  startedAt: r.started_at,
});

function toEvent(r: EventRow): SubagentEvent {
  let json: unknown;
  try {
    json = JSON.parse(r.data);
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `subagent event: ${String(e)}`);
  }
  const parsed = EventData.safeParse({ ...Object(json), type: r.type });
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `subagent event: ${parsed.error.message}`);
  return { ...parsed.data, at: r.at };
}

const dataOf = (event: SubagentEvent): object => {
  if (event.type === "linked") return { facts: event.facts };
  if (event.type === "ended") return { isError: event.isError, result: event.result };
  return {};
};

export function createSubagentStore(db: Database, factsOf: SubagentFactsOf = NO_FACTS): SubagentStore {
  for (const sql of SCHEMA) db.exec(sql);
  const insert = db.query(
    "INSERT INTO run_subagents (id, run_id, tool_use_id, type, description, prompt, model, parent_id, " +
      "transcript_path, started_at) VALUES ($id, $run_id, $tool_use_id, $type, $description, $prompt, $model, " +
      "$parent_id, $transcript_path, $started_at) ON CONFLICT (id) DO NOTHING",
  );
  const one = db.query("SELECT * FROM run_subagents WHERE id = $id");
  const ofRun = db.query("SELECT * FROM run_subagents WHERE run_id = $run_id ORDER BY started_at, id");
  const addEvent = db.query(
    "INSERT INTO run_subagent_events (subagent_id, type, data, at) VALUES ($id, $type, $data, $at)",
  );
  const eventsOf = db.query(
    "SELECT type, data, at FROM run_subagent_events WHERE subagent_id = $id ORDER BY id",
  );
  const byToolUse = db.query(
    "SELECT s.id FROM run_subagents s WHERE s.run_id = $run_id AND (s.tool_use_id = $tool_use_id OR EXISTS (" +
      "SELECT 1 FROM run_subagent_events e WHERE e.subagent_id = s.id AND e.type = 'linked' " +
      "AND json_extract(e.data, '$.facts.toolUseId') = $tool_use_id)) LIMIT 1",
  );
  const traceOf = db.query("SELECT * FROM run_subagent_traces WHERE subagent_id = $id");
  const upsertTrace = db.query(
    "INSERT INTO run_subagent_traces (subagent_id, run_id, path, offset, closed_at) " +
      "VALUES ($subagent_id, $run_id, $path, $offset, $closed_at) ON CONFLICT (subagent_id) DO UPDATE SET " +
      "path = excluded.path, offset = excluded.offset, closed_at = excluded.closed_at",
  );

  const get = (id: string): SubagentRow | null => {
    const row = one.get({ id }) as Row | null;
    return row ? toRow(row) : null;
  };
  const events = (id: string): SubagentEvent[] => (eventsOf.all({ id }) as EventRow[]).map(toEvent);
  const fold = (row: SubagentRow): RunSubagent =>
    foldSubagent(row, events(row.id), factsOf(row.runId, row.id));

  return {
    create(row) {
      const { changes } = insert.run({
        id: row.id,
        run_id: row.runId,
        tool_use_id: row.toolUseId,
        type: row.type,
        description: row.description,
        prompt: row.prompt,
        model: row.model,
        parent_id: row.parentId,
        transcript_path: row.transcriptPath,
        started_at: row.startedAt,
      });
      if (changes === 0) throw new KiboError("CONFLICT", `subagent ${row.id} already exists`);
    },
    get,
    append(id, event) {
      addEvent.run({ id, type: event.type, data: JSON.stringify(dataOf(event)), at: event.at });
    },
    events,
    byToolUse(runId, toolUseId) {
      const row = byToolUse.get({ run_id: runId, tool_use_id: toolUseId }) as { id: string } | null;
      return row?.id ?? null;
    },
    find(id) {
      const row = get(id);
      return row ? fold(row) : null;
    },
    list: (runId) => (ofRun.all({ run_id: runId }) as Row[]).map((r) => fold(toRow(r))),
    trace(id) {
      const row = traceOf.get({ id }) as TraceRow | null;
      return row
        ? {
            subagentId: row.subagent_id,
            runId: row.run_id,
            path: row.path,
            offset: row.offset,
            closedAt: row.closed_at,
          }
        : null;
    },
    saveTrace(t) {
      upsertTrace.run({
        subagent_id: t.subagentId,
        run_id: t.runId,
        path: t.path,
        offset: t.offset,
        closed_at: t.closedAt,
      });
    },
    close: () => db.close(),
  };
}

export const openSubagentStore = (home: string, factsOf?: SubagentFactsOf): SubagentStore =>
  createSubagentStore(openRunsDatabase(home, "subagent"), factsOf);
