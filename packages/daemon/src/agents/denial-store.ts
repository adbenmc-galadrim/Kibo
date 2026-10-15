import type { Database } from "bun:sqlite";
import { type DenialItem, KiboError, type RunDenials } from "@kibo/schema";
import { z } from "zod";

export type DenialRow = RunDenials & { seq: number };
export type DenialStore = {
  save(row: DenialRow): RunDenials;
  get(runId: string): RunDenials | null;
  lastSeq(runId: string): number;
};

const SCHEMA =
  "CREATE TABLE IF NOT EXISTS run_denials (run_id TEXT NOT NULL, turn INTEGER NOT NULL, items TEXT NOT NULL, " +
  "question_id TEXT, seq INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (run_id, turn))";

const StoredItems: z.ZodType<DenialItem[], z.ZodTypeDef, unknown> = z.array(
  z.object({
    tool: z.string(),
    target: z.string(),
    rule: z.string().nullable(),
    addDir: z.string().nullable(),
    reason: z.enum(["ok", "shell", "mcp", "unknown"]),
  }),
);

type Row = {
  run_id: string;
  turn: number;
  items: string;
  question_id: string | null;
  seq: number;
  at: number;
};

function itemsOf(row: Row): DenialItem[] {
  try {
    return StoredItems.parse(JSON.parse(row.items));
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `denials of run ${row.run_id} turn ${row.turn}: ${String(e)}`);
  }
}

const toDenials = (row: Row): RunDenials => ({
  runId: row.run_id,
  turn: row.turn,
  items: itemsOf(row),
  questionId: row.question_id,
  at: row.at,
});

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Error && /UNIQUE constraint failed|PRIMARY KEY/i.test(e.message);

export function denialStore(db: Database): DenialStore {
  db.exec(SCHEMA);
  const insert = db.query(
    "INSERT INTO run_denials (run_id, turn, items, question_id, seq, at) " +
      "VALUES ($run_id, $turn, $items, $question_id, $seq, $at)",
  );
  const last = db.query<Row, { run_id: string }>(
    "SELECT * FROM run_denials WHERE run_id = $run_id ORDER BY turn DESC LIMIT 1",
  );
  const read = (runId: string): Row | null => last.get({ run_id: runId });
  return {
    save(row) {
      try {
        insert.run({
          run_id: row.runId,
          turn: row.turn,
          items: JSON.stringify(row.items),
          question_id: row.questionId,
          seq: row.seq,
          at: row.at,
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new KiboError("CONFLICT", `denials of run ${row.runId} turn ${row.turn} already saved`);
        }
        throw e;
      }
      return { runId: row.runId, turn: row.turn, items: row.items, questionId: row.questionId, at: row.at };
    },
    get(runId) {
      const row = read(runId);
      return row === null ? null : toDenials(row);
    },
    lastSeq: (runId) => read(runId)?.seq ?? -1,
  };
}
