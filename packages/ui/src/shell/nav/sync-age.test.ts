import { expect, test } from "bun:test";
import type { SyncStatus } from "@kibo/schema";
import { syncChipText, syncState } from "./sync-age";

const NOW = Date.UTC(2026, 9, 16, 12, 52);
const status = (lastSyncAt: number | null): SyncStatus => ({
  state: "online",
  serverUrl: "wss://sync",
  user: null,
  deviceId: null,
  retryAt: null,
  lastError: null,
  projects: [
    { projectId: "silo", name: "Silo", role: "owner", lastSyncAt, lastError: null, accessRevoked: false },
  ],
});
const down = (lastError: string | null): SyncStatus => ({
  ...status(NOW - 60_000),
  state: "offline",
  lastError,
});
const failing: SyncStatus = {
  ...status(NOW - 60_000),
  projects: [
    {
      projectId: "silo",
      name: "Silo",
      role: "owner",
      lastSyncAt: NOW,
      lastError: "boom",
      accessRevoked: false,
    },
  ],
};

test("a synced project tells how long ago it last synced", () => {
  expect(syncState(status(NOW - 60_000), "silo", NOW, "hidden")).toEqual({
    kind: "synced",
    age: "il y a 1 min",
  });
  expect(syncState(status(null), "silo", NOW, "hidden")).toEqual({ kind: "synced", age: null });
  expect(syncState(status(NOW), "other", NOW, "hidden")).toEqual({ kind: "synced", age: null });
  expect(syncState(null, "silo", NOW, "hidden")).toEqual({ kind: "synced", age: null });
});

test("execution hidden, the state says when the sync is offline or failing", () => {
  expect(syncState(down(null), "silo", NOW, "hidden")).toEqual({ kind: "offline" });
  expect(syncState(down("SYNC_OFFLINE"), "silo", NOW, "hidden")).toEqual({ kind: "offline" });
  expect(syncState(down("SYNC_REJECTED"), "silo", NOW, "hidden")).toEqual({ kind: "error" });
  expect(syncState(failing, "silo", NOW, "hidden")).toEqual({ kind: "error" });
});

test("execution shown, the chip keeps the age and the agents bar tells the sync state", () => {
  expect(syncState(down(null), "silo", NOW, "shown")).toEqual({ kind: "synced", age: "il y a 1 min" });
});

test("the chip reads Synchronisé with its age, or the inactive state alone", () => {
  expect(syncChipText({ kind: "synced", age: "il y a 1 min" })).toEqual({
    label: "Synchronisé",
    age: "il y a 1 min",
  });
  expect(syncChipText({ kind: "synced", age: null })).toEqual({ label: "Synchronisé", age: null });
  expect(syncChipText({ kind: "offline" })).toEqual({ label: "Hors ligne", age: null });
  expect(syncChipText({ kind: "error" })).toEqual({ label: "Erreur de sync", age: null });
});

test("daemon unreachable: Hors connexion · reconnexion…, then Synchronisé once it is back", () => {
  const offline = syncState(status(NOW - 60_000), "silo", NOW, "hidden", false);
  expect(offline).toEqual({ kind: "reconnecting" });
  expect(syncChipText(offline)).toEqual({ label: "Hors connexion · reconnexion…", age: null });
  expect(syncState(null, "silo", NOW, "hidden", false)).toEqual({ kind: "reconnecting" });
  expect(syncChipText(syncState(status(NOW - 60_000), "silo", NOW, "hidden", true))).toEqual({
    label: "Synchronisé",
    age: "il y a 1 min",
  });
});
