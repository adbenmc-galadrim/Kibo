import { z } from "zod";

export const SessionState = z.enum(["start", "ping", "stop"]);
export type SessionState = z.infer<typeof SessionState>;

export const SessionTool = z.string().trim().min(1).max(40);
export const TicketSession = z.object({ tool: SessionTool, startedAt: z.number().int() });
export type TicketSession = z.infer<typeof TicketSession>;

export const SESSION_TIMEOUT_MS = 2 * 3_600_000;
export const DEFAULT_SESSION_TOOL = "T3 Code";

export type SessionRow = { ticketId: string; tool: string; startedAt: number; lastSeenAt: number };

export const isSessionAlive = (row: Pick<SessionRow, "lastSeenAt">, now: number): boolean =>
  row.lastSeenAt + SESSION_TIMEOUT_MS > now;

export function activeSessions(rows: readonly SessionRow[], now: number): Map<string, TicketSession> {
  return new Map(
    rows
      .filter((r) => isSessionAlive(r, now))
      .map((r) => [r.ticketId, { tool: r.tool, startedAt: r.startedAt }]),
  );
}
