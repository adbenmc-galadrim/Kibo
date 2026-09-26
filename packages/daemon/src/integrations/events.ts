import type { Database } from "bun:sqlite";
import type { IntegrationId } from "@kibo/schema";
import type { Redactor } from "./redact";

export type EventLevel = "info" | "warn" | "error";
export type EventEntry = { at: number; level: string; message: string };
export type EventLog = {
  log(integration: IntegrationId, level: EventLevel, message: string): void;
  recent(integration: IntegrationId, limit?: number): EventEntry[];
};

const MAX_MESSAGE = 2000;

export function createEventLog(db: Database, redactor: Redactor, now: () => number): EventLog {
  const insert = db.query<
    null,
    { at: number; integration: IntegrationId; level: EventLevel; message: string }
  >(
    "INSERT INTO integration_events (at, integration, level, message) VALUES ($at, $integration, $level, $message)",
  );
  const select = db.query<EventEntry, { integration: IntegrationId; limit: number }>(
    "SELECT at, level, message FROM integration_events WHERE integration = $integration ORDER BY id DESC LIMIT $limit",
  );
  return {
    log(integration, level, message) {
      insert.run({ at: now(), integration, level, message: redactor.redact(message).slice(0, MAX_MESSAGE) });
    },
    recent(integration, limit = 50) {
      return select.all({ integration, limit });
    },
  };
}
