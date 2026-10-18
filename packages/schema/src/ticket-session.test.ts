import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";
import {
  activeSessions,
  DEFAULT_SESSION_TOOL,
  SESSION_TIMEOUT_MS,
  SessionState,
  TicketSession,
} from "./ticket-session";
import { TRACKING_RPC_METHODS } from "./tracking-rpc";

const NOW = 1_760_000_000_000;

test("a session expires two hours after its last sign of life", () => {
  const rows = [
    { ticketId: "a", tool: "T3 Code", startedAt: NOW - 5_000_000, lastSeenAt: NOW - SESSION_TIMEOUT_MS },
    { ticketId: "b", tool: "Cursor", startedAt: NOW - 9_000_000, lastSeenAt: NOW - SESSION_TIMEOUT_MS + 1 },
    { ticketId: "c", tool: "T3 Code", startedAt: NOW - 60_000, lastSeenAt: NOW - 1 },
  ];
  const active = activeSessions(rows, NOW);
  expect([...active.keys()]).toEqual(["b", "c"]);
  expect(active.get("b")).toEqual({ tool: "Cursor", startedAt: NOW - 9_000_000 });
  expect(SESSION_TIMEOUT_MS).toBe(7_200_000);
});

test("a session names its tool and its state is closed", () => {
  expect(DEFAULT_SESSION_TOOL).toBe("T3 Code");
  expect(TicketSession.parse({ tool: " Cursor ", startedAt: 1 }).tool).toBe("Cursor");
  expect(TicketSession.safeParse({ tool: "", startedAt: 1 }).success).toBe(false);
  expect(TicketSession.safeParse({ tool: "x".repeat(41), startedAt: 1 }).success).toBe(false);
  expect(SessionState.options).toEqual(["start", "ping", "stop"]);
});

test("a session is declared by key or by folder", () => {
  const ok = (raw: unknown) => RpcRequest.safeParse(raw).success;
  const base = { method: "setTicketSession", projectId: "p" };
  expect(ok({ ...base, ticketKey: "SILO-33", cwd: null, state: "start", tool: "T3 Code" })).toBe(true);
  expect(ok({ ...base, ticketKey: null, cwd: "/Users/adam/silo", state: "ping" })).toBe(true);
  expect(ok({ ...base, ticketKey: null, cwd: "silo", state: "ping" })).toBe(false);
  expect(ok({ ...base, ticketKey: "SILO-33", cwd: null, state: "pause" })).toBe(false);
  expect(TRACKING_RPC_METHODS).toContain("setTicketSession");
});
