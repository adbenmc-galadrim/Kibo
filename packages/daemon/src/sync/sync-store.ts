import type { Database } from "bun:sqlite";
import { isKiboErrorCode, type KiboErrorCode, type OutboxError, SyncedFields } from "@kibo/schema";
import { z } from "zod";

export const IGNORED = "";
export type SyncItem = {
  bindingId: string;
  remoteId: string;
  ticketId: string;
  base: SyncedFields;
  remoteUpdatedAt: string;
  lastPushedHash: string | null;
};
type ErrorInfo = { code: KiboErrorCode; message: string };
export type OutboxRow = {
  id: number;
  bindingId: string;
  projectId: string;
  ticketId: string;
  op: "create" | "update";
  attempts: number;
  nextAttemptAt: number | null;
  firstAttemptAt: string | null;
  lastError: ErrorInfo | null;
  uncertain: boolean;
};
export type CursorRow = {
  bindingId: string;
  projectId: string;
  cursor: string | null;
  lastPullAt: number | null;
  lastError: ErrorInfo | null;
  imported: number;
};

const ErrorJson = z.object({ code: z.custom<KiboErrorCode>(isKiboErrorCode), message: z.string() });
const readError = (raw: string | null): ErrorInfo | null =>
  raw === null ? null : ErrorJson.parse(JSON.parse(raw));

type ItemRow = {
  binding_id: string;
  remote_id: string;
  ticket_id: string;
  base_json: string;
  remote_updated_at: string;
  last_pushed_hash: string | null;
};
type OutRow = {
  id: number;
  binding_id: string;
  project_id: string;
  ticket_id: string;
  op: string;
  attempts: number;
  next_attempt_at: number | null;
  first_attempt_at: string | null;
  uncertain: number;
  last_error: string | null;
};
type CurRow = {
  binding_id: string;
  project_id: string;
  cursor: string | null;
  last_pull_at: number | null;
  last_error: string | null;
  imported: number;
};

const toItem = (r: ItemRow): SyncItem => ({
  bindingId: r.binding_id,
  remoteId: r.remote_id,
  ticketId: r.ticket_id,
  base: SyncedFields.parse(JSON.parse(r.base_json)),
  remoteUpdatedAt: r.remote_updated_at,
  lastPushedHash: r.last_pushed_hash,
});
const toOut = (r: OutRow): OutboxRow => ({
  id: r.id,
  bindingId: r.binding_id,
  projectId: r.project_id,
  ticketId: r.ticket_id,
  op: r.op === "create" ? "create" : "update",
  attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at,
  firstAttemptAt: r.first_attempt_at,
  lastError: readError(r.last_error),
  uncertain: r.uncertain === 1,
});

export function createSyncStore(db: Database) {
  const q = {
    item: db.query<ItemRow, { b: string; r: string }>(
      "SELECT * FROM sync_items WHERE binding_id = $b AND remote_id = $r",
    ),
    itemByTicket: db.query<ItemRow, { b: string; t: string }>(
      "SELECT * FROM sync_items WHERE binding_id = $b AND ticket_id = $t AND ticket_id <> ''",
    ),
    upsertItem: db.query(
      "INSERT INTO sync_items VALUES ($b, $r, $t, $base, $at, $hash) ON CONFLICT(binding_id, remote_id) DO UPDATE SET ticket_id = excluded.ticket_id, base_json = excluded.base_json, remote_updated_at = excluded.remote_updated_at, last_pushed_hash = excluded.last_pushed_hash",
    ),
    ignoreTicket: db.query("UPDATE sync_items SET ticket_id = '' WHERE ticket_id = $t"),
    deleteItem: db.query("DELETE FROM sync_items WHERE binding_id = $b AND remote_id = $r"),
    outbox: db.query<OutRow, { b: string }>("SELECT * FROM sync_outbox WHERE binding_id = $b ORDER BY id"),
    head: db.query<OutRow, { b: string }>(
      "SELECT * FROM sync_outbox WHERE binding_id = $b ORDER BY id LIMIT 1",
    ),
    uncertainCreate: db.query<{ found: number }, { b: string }>(
      "SELECT EXISTS (SELECT 1 FROM sync_outbox WHERE binding_id = $b AND op = 'create' AND uncertain = 1) AS found",
    ),
    row: db.query<OutRow, { id: number }>("SELECT * FROM sync_outbox WHERE id = $id"),
    outboxOfTicket: db.query<OutRow, { b: string; t: string }>(
      "SELECT * FROM sync_outbox WHERE binding_id = $b AND ticket_id = $t ORDER BY id",
    ),
    enqueue: db.query(
      "INSERT INTO sync_outbox (binding_id, project_id, ticket_id, op, payload_json, created_at) VALUES ($b, $p, $t, $op, $payload, $at)",
    ),
    attempt: db.query(
      "UPDATE sync_outbox SET attempts = $attempts, next_attempt_at = $next, first_attempt_at = $first, last_error = $error, uncertain = $uncertain WHERE id = $id",
    ),
    deleteOutbox: db.query("DELETE FROM sync_outbox WHERE id = $id"),
    deleteOutboxOfTicket: db.query("DELETE FROM sync_outbox WHERE ticket_id = $t"),
    pending: db.query<{ ticket_id: string }, { p: string }>(
      "SELECT DISTINCT ticket_id FROM sync_outbox WHERE project_id = $p ORDER BY ticket_id",
    ),
    errors: db.query<OutRow, { p: string }>(
      "SELECT * FROM sync_outbox WHERE project_id = $p AND last_error IS NOT NULL AND next_attempt_at IS NULL ORDER BY id",
    ),
    cursor: db.query<CurRow, { b: string }>("SELECT * FROM sync_cursors WHERE binding_id = $b"),
    saveCursor: db.query(
      "INSERT INTO sync_cursors VALUES ($b, $p, $cursor, $at, $error, $imported) ON CONFLICT(binding_id) DO UPDATE SET cursor = excluded.cursor, last_pull_at = excluded.last_pull_at, last_error = excluded.last_error, imported = excluded.imported",
    ),
    dropBinding: [
      db.query("DELETE FROM sync_items WHERE binding_id = $b"),
      db.query("DELETE FROM sync_outbox WHERE binding_id = $b"),
      db.query("DELETE FROM sync_cursors WHERE binding_id = $b"),
    ],
  };
  const json = (e: ErrorInfo | null) => (e === null ? null : JSON.stringify(e));
  return {
    item: (b: string, r: string) => {
      const row = q.item.get({ b, r });
      return row ? toItem(row) : null;
    },
    itemByTicket: (b: string, t: string) => {
      const row = q.itemByTicket.get({ b, t });
      return row ? toItem(row) : null;
    },
    upsertItem: (i: SyncItem) => {
      q.upsertItem.run({
        b: i.bindingId,
        r: i.remoteId,
        t: i.ticketId,
        base: JSON.stringify(i.base),
        at: i.remoteUpdatedAt,
        hash: i.lastPushedHash,
      });
    },
    ignoreTickets: (ids: string[]) => {
      for (const t of ids) q.ignoreTicket.run({ t });
    },
    deleteItem: (b: string, r: string) => {
      q.deleteItem.run({ b, r });
    },
    enqueue(
      row: { bindingId: string; projectId: string; ticketId: string; op: "create" | "update" },
      now: number,
    ) {
      const existing = q.outboxOfTicket.all({ b: row.bindingId, t: row.ticketId });
      if (existing.length > 0) return;
      q.enqueue.run({
        b: row.bindingId,
        p: row.projectId,
        t: row.ticketId,
        op: row.op,
        payload: JSON.stringify({ op: row.op }),
        at: now,
      });
    },
    outbox: (b: string) => q.outbox.all({ b }).map(toOut),
    head(b: string, now: number): OutboxRow | null {
      const first = q.head.get({ b });
      if (!first) return null;
      const row = toOut(first);
      if (row.nextAttemptAt === null && row.lastError !== null) return null;
      if (row.nextAttemptAt !== null && row.nextAttemptAt > now) return null;
      return row;
    },
    uncertainCreate: (b: string) => q.uncertainCreate.get({ b })?.found === 1,
    attempt(
      id: number,
      patch: Pick<OutboxRow, "attempts" | "nextAttemptAt" | "firstAttemptAt" | "lastError" | "uncertain">,
    ) {
      q.attempt.run({
        id,
        attempts: patch.attempts,
        next: patch.nextAttemptAt,
        first: patch.firstAttemptAt,
        error: json(patch.lastError),
        uncertain: patch.uncertain ? 1 : 0,
      });
    },
    row(id: number): OutboxRow | null {
      const r = q.row.get({ id });
      return r ? toOut(r) : null;
    },
    deleteOutbox: (id: number) => {
      q.deleteOutbox.run({ id });
    },
    deleteOutboxOfTickets: (ids: string[]) => {
      for (const t of ids) q.deleteOutboxOfTicket.run({ t });
    },
    pending: (p: string) => q.pending.all({ p }).map((r) => r.ticket_id),
    errors: (p: string): OutboxError[] =>
      q.errors.all({ p }).flatMap((r) => {
        const e = readError(r.last_error);
        return e ? [{ outboxId: r.id, ticketId: r.ticket_id, code: e.code, message: e.message }] : [];
      }),
    cursor(b: string): CursorRow | null {
      const r = q.cursor.get({ b });
      return r
        ? {
            bindingId: r.binding_id,
            projectId: r.project_id,
            cursor: r.cursor,
            lastPullAt: r.last_pull_at,
            lastError: readError(r.last_error),
            imported: r.imported,
          }
        : null;
    },
    saveCursor: (c: CursorRow) => {
      q.saveCursor.run({
        b: c.bindingId,
        p: c.projectId,
        cursor: c.cursor,
        at: c.lastPullAt,
        error: json(c.lastError),
        imported: c.imported,
      });
    },
    dropBinding: (b: string) => {
      for (const s of q.dropBinding) s.run({ b });
    },
  };
}
export type SyncStore = ReturnType<typeof createSyncStore>;
