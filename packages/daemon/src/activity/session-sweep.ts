import type { ProjectEventSink } from "@kibo/schema";
import { recordStopped, type SessionTicket } from "./session-events";
import type { SessionStore } from "./session-store";

export type SessionSweepDeps = {
  store: Pick<SessionStore, "sweep">;
  tickets(projectId: string): readonly SessionTicket[];
  now(): number;
  sink?: ProjectEventSink;
  emit(projectId: string): void;
  log(what: string): (e: unknown) => void;
};

export function createSessionSweep(deps: SessionSweepDeps): { pass(): void } {
  return {
    pass() {
      const closed = deps.store.sweep(deps.now());
      for (const session of closed) {
        try {
          recordStopped(deps.sink, deps.tickets(session.projectId), session, "timeout");
        } catch (e) {
          deps.log(`journaling the silent session of ${session.ticketId}`)(e);
        }
      }
      for (const projectId of new Set(closed.map((s) => s.projectId))) deps.emit(projectId);
    },
  };
}
