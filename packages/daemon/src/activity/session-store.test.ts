import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { SESSION_TIMEOUT_MS } from "@kibo/schema";
import { createSessionStore } from "./session-store";

const T0 = 1_760_000_000_000;
const store = () => createSessionStore(new Database(":memory:", { strict: true }));

test("start opens a session whose start and last sign of life are now", () => {
  const sessions = store();
  expect(sessions.start("p", "t1", "T3 Code", T0)).toEqual({
    projectId: "p",
    ticketId: "t1",
    tool: "T3 Code",
    startedAt: T0,
    lastSeenAt: T0,
  });
  expect(sessions.active("p", T0)).toEqual(new Map([["t1", { tool: "T3 Code", startedAt: T0 }]]));
  expect(sessions.active("other", T0)).toEqual(new Map());
});

test("a repeated start only pings and keeps the start and the tool", () => {
  const sessions = store();
  sessions.start("p", "t1", "T3 Code", T0);
  expect(sessions.start("p", "t1", "Cursor", T0 + 60_000)).toMatchObject({
    tool: "T3 Code",
    startedAt: T0,
    lastSeenAt: T0 + 60_000,
  });
});

test("ping extends an open session and ignores a ticket without one", () => {
  const sessions = store();
  sessions.start("p", "t1", "T3 Code", T0);
  expect(sessions.ping("p", "t1", T0 + 90 * 60_000)?.lastSeenAt).toBe(T0 + 90 * 60_000);
  expect(sessions.active("p", T0 + 3 * 3_600_000).has("t1")).toBe(true);
  expect(sessions.ping("p", "t2", T0)).toBeNull();
});

test("stop removes the session and gives its duration", () => {
  const sessions = store();
  sessions.start("p", "t1", "T3 Code", T0);
  expect(sessions.stop("p", "t1", T0 + 42 * 60_000)).toMatchObject({
    ticketId: "t1",
    tool: "T3 Code",
    durationMs: 42 * 60_000,
  });
  expect(sessions.active("p", T0).size).toBe(0);
  expect(sessions.stop("p", "t1", T0)).toBeNull();
});

test("a session silent for two hours is no longer active", () => {
  const sessions = store();
  sessions.start("p", "t1", "T3 Code", T0);
  expect(sessions.active("p", T0 + SESSION_TIMEOUT_MS - 1).has("t1")).toBe(true);
  expect(sessions.active("p", T0 + SESSION_TIMEOUT_MS).has("t1")).toBe(false);
  expect(sessions.ping("p", "t1", T0 + SESSION_TIMEOUT_MS)).toBeNull();
});

test("a start after a silent session opens a new one", () => {
  const sessions = store();
  sessions.start("p", "t1", "T3 Code", T0);
  const later = T0 + SESSION_TIMEOUT_MS + 1;
  expect(sessions.start("p", "t1", "Cursor", later)).toMatchObject({ tool: "Cursor", startedAt: later });
});

test("sweep closes the silent sessions, ending them at their last sign of life", () => {
  const sessions = store();
  sessions.start("p", "t1", "T3 Code", T0);
  sessions.ping("p", "t1", T0 + 30 * 60_000);
  sessions.start("q", "t2", "T3 Code", T0 + SESSION_TIMEOUT_MS);
  const closed = sessions.sweep(T0 + 30 * 60_000 + SESSION_TIMEOUT_MS);
  expect(closed).toEqual([
    {
      projectId: "p",
      ticketId: "t1",
      tool: "T3 Code",
      startedAt: T0,
      lastSeenAt: T0 + 30 * 60_000,
      durationMs: 30 * 60_000,
    },
  ]);
  expect(sessions.sweep(T0 + 30 * 60_000 + SESSION_TIMEOUT_MS)).toEqual([]);
  expect(sessions.active("q", T0 + SESSION_TIMEOUT_MS).has("t2")).toBe(true);
});

test("the sessions survive a reopening of the database", () => {
  const db = new Database(":memory:", { strict: true });
  createSessionStore(db).start("p", "t1", "T3 Code", T0);
  expect(createSessionStore(db).active("p", T0).has("t1")).toBe(true);
});
