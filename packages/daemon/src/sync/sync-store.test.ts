import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import type { SyncedFields } from "@kibo/schema";
import { migrateIntegrations } from "../integrations/db";
import { createSyncStore, IGNORED } from "./sync-store";

test("one pending row per ticket, FIFO head, manual errors block the binding", () => {
  const db = new Database(":memory:", { strict: true });
  migrateIntegrations(db);
  const s = createSyncStore(db);
  s.enqueue({ bindingId: "b", projectId: "p", ticketId: "t1", op: "create" }, 1);
  s.enqueue({ bindingId: "b", projectId: "p", ticketId: "t1", op: "update" }, 2);
  s.enqueue({ bindingId: "b", projectId: "p", ticketId: "t2", op: "update" }, 3);
  expect(s.outbox("b").map((r) => [r.ticketId, r.op])).toEqual([
    ["t1", "create"],
    ["t2", "update"],
  ]);
  const head = s.head("b", 10);
  if (!head) throw new Error("head missing");
  expect(head.ticketId).toBe("t1");
  s.attempt(head.id, {
    attempts: 1,
    nextAttemptAt: 100,
    firstAttemptAt: "2026-09-26T10:00:00Z",
    lastError: null,
    uncertain: true,
  });
  expect(s.head("b", 10)).toBeNull();
  expect(s.uncertainCreate("b")).toBe(true);
  s.attempt(head.id, {
    attempts: 1,
    nextAttemptAt: null,
    firstAttemptAt: null,
    lastError: { code: "REMOTE_REJECTED", message: "422" },
    uncertain: true,
  });
  expect(s.head("b", 1_000)).toBeNull();
  expect(s.errors("p")).toEqual([
    { outboxId: head.id, ticketId: "t1", op: "create", code: "REMOTE_REJECTED", message: "422" },
  ]);
  expect(s.pending("p")).toEqual(["t1", "t2"]);
});

test("several deleted tickets of one binding can all be ignored", () => {
  const db = new Database(":memory:", { strict: true });
  migrateIntegrations(db);
  const s = createSyncStore(db);
  const base: SyncedFields = { title: "A", description: "", statusId: "todo", closed: false };
  for (const n of ["1", "2"]) {
    s.upsertItem({
      bindingId: "b",
      remoteId: n,
      ticketId: `t${n}`,
      base,
      remoteUpdatedAt: "2026-09-26T10:00:00Z",
      lastPushedHash: null,
    });
  }
  s.ignoreTickets(["t1", "t2"]);
  expect([s.item("b", "1")?.ticketId, s.item("b", "2")?.ticketId]).toEqual([IGNORED, IGNORED]);
});

test("an outbox created before the uncertain flag gains it on migration", () => {
  const db = new Database(":memory:", { strict: true });
  db.exec(
    "CREATE TABLE sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, binding_id TEXT NOT NULL, project_id TEXT NOT NULL, ticket_id TEXT NOT NULL, op TEXT NOT NULL, payload_json TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER, first_attempt_at TEXT, last_error TEXT, created_at INTEGER NOT NULL)",
  );
  migrateIntegrations(db);
  migrateIntegrations(db);
  const s = createSyncStore(db);
  s.enqueue({ bindingId: "b", projectId: "p", ticketId: "t1", op: "create" }, 1);
  expect(s.outbox("b")[0]?.uncertain).toBe(false);
});
