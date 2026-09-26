import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { migrateIntegrations } from "./db";
import { createEventLog } from "./events";
import { createRedactor } from "./redact";
import { createSettings } from "./settings";

test("events are redacted, truncated and listed newest first", () => {
  const db = new Database(":memory:", { strict: true });
  migrateIntegrations(db);
  const r = createRedactor();
  r.add("s3cret-value-123");
  let now = 1;
  const log = createEventLog(db, r, () => now++);
  log.log("github", "error", "failed with s3cret-value-123");
  log.log("github", "info", "x".repeat(5000));
  const recent = log.recent("github");
  expect(recent[0]?.message).toHaveLength(2000);
  expect(recent[1]?.message).toBe("failed with ***");
  const raw = JSON.stringify(db.query("SELECT * FROM integration_events").all());
  expect(raw).not.toContain("s3cret");
});

test("settings round-trip", () => {
  const db = new Database(":memory:", { strict: true });
  migrateIntegrations(db);
  const s = createSettings(db);
  expect(s.get("github.mode")).toBeNull();
  s.set("github.mode", "gh");
  s.set("github.mode", "token");
  expect(s.get("github.mode")).toBe("token");
  s.delete("github.mode");
  expect(s.get("github.mode")).toBeNull();
});
