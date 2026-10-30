import { expect, test } from "bun:test";
import { Phase7Event } from "./daemon-events";

test("daemon events do not reuse integration event types and no longer carry sync or market", () => {
  expect(Phase7Event.safeParse({ type: "sessions.changed" }).success).toBe(true);
  expect(Phase7Event.safeParse({ type: "backups.changed" }).success).toBe(true);
  expect(Phase7Event.safeParse({ type: "market.changed" }).success).toBe(false);
  expect(Phase7Event.safeParse({ type: "sandbox.changed" }).success).toBe(false);
  expect(Phase7Event.safeParse({ type: "sync" }).success).toBe(false);
});
