import { expect, test } from "bun:test";
import type { SyncStatus } from "@kibo/schema";
import { syncAge } from "./sync-age";

const NOW = Date.UTC(2026, 9, 16, 12, 52);
const status = (lastSyncAt: number | null): SyncStatus => ({
  state: "online",
  serverUrl: "wss://sync",
  user: null,
  deviceId: null,
  retryAt: null,
  lastError: null,
  projects: [
    { projectId: "emis", name: "Emis", role: "owner", lastSyncAt, lastError: null, accessRevoked: false },
  ],
});

test("the chip says how long ago the project last synced", () => {
  expect(syncAge(status(NOW - 60_000), "emis", NOW)).toBe("il y a 1 min");
  expect(syncAge(status(null), "emis", NOW)).toBeNull();
  expect(syncAge(status(NOW), "other", NOW)).toBeNull();
  expect(syncAge(null, "emis", NOW)).toBeNull();
});
