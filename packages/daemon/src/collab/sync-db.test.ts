import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { openSyncDb } from "./sync-db";

test("stores a single server configuration", () => {
  const db = openSyncDb(new Database(":memory:", { strict: true }));
  expect(db.config()).toBeNull();
  const config = {
    serverUrl: "wss://sync.kibo.test",
    caFile: null,
    userId: "u1",
    deviceId: "d1",
    displayName: "Adam",
  };
  db.setConfig(config);
  db.setConfig({ ...config, displayName: "Adam B." });
  expect(db.config()).toEqual({ ...config, displayName: "Adam B." });
  db.setConfig(null);
  expect(db.config()).toBeNull();
});

test("round-trips project rows with their server version", () => {
  const db = openSyncDb(new Database(":memory:", { strict: true }));
  const row = {
    projectId: "p1",
    enabled: true,
    role: "editor" as const,
    lastServerVersion: new Uint8Array([1, 2, 3]),
    lastSyncAt: 10,
    lastError: null,
    accessRevoked: false,
  };
  db.upsertProject(row);
  db.upsertProject({ ...row, lastSyncAt: 20 });
  expect(db.project("p1")).toEqual({ ...row, lastSyncAt: 20 });
  expect(db.projects()).toHaveLength(1);
  db.removeProject("p1");
  expect(db.project("p1")).toBeNull();
});
