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
  expect(syncAge(status(NOW - 60_000), "emis", NOW, "hidden")).toBe("il y a 1 min");
  expect(syncAge(status(null), "emis", NOW, "hidden")).toBeNull();
  expect(syncAge(status(NOW), "other", NOW, "hidden")).toBeNull();
  expect(syncAge(null, "emis", NOW, "hidden")).toBeNull();
});

const down = (lastError: string | null): SyncStatus => ({
  ...status(NOW - 60_000),
  state: "offline",
  lastError,
});

test("execution hidden, the chip says when the sync is offline or failing instead of its age", () => {
  expect(syncAge(down(null), "emis", NOW, "hidden")).toBe("hors ligne");
  expect(syncAge(down("SYNC_OFFLINE"), "emis", NOW, "hidden")).toBe("hors ligne");
  expect(syncAge(down("SYNC_REJECTED"), "emis", NOW, "hidden")).toBe("erreur de sync");
  const failing: SyncStatus = {
    ...status(NOW - 60_000),
    projects: [
      {
        projectId: "emis",
        name: "Emis",
        role: "owner",
        lastSyncAt: NOW,
        lastError: "boom",
        accessRevoked: false,
      },
    ],
  };
  expect(syncAge(failing, "emis", NOW, "hidden")).toBe("erreur de sync");
  expect(syncAge(status(NOW - 60_000), "emis", NOW, "hidden")).toBe("il y a 1 min");
});

test("execution shown, the chip keeps the age and the agents bar tells the sync state", () => {
  expect(syncAge(down(null), "emis", NOW, "shown")).toBe("il y a 1 min");
});
