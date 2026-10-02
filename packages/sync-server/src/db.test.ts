import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, readAudit } from "./audit";
import { openServerDb } from "./db";
import { holdWriteLock } from "./testing/hold-write-lock";

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test("creates the database file with mode 0600 in a 0700 directory", () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-db-"));
  const file = join(dir, "data", "sync.db");
  const sdb = openServerDb(file);
  audit(sdb, { at: 1, kind: "connect", userId: "u1" });
  expect(statSync(file).mode & 0o777).toBe(0o600);
  expect(statSync(join(dir, "data")).mode & 0o777).toBe(0o700);
  sdb.close();
});

test("a write waits for another process to release its lock", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-db-"));
  const file = join(dir, "sync.db");
  const sdb = openServerDb(file);
  const lock = await holdWriteLock(file, 300);
  audit(sdb, { at: 1, kind: "connect", userId: "u1" });
  expect(await lock.released).toBe(0);
  expect(readAudit(sdb, 10).map((e) => e.kind)).toEqual(["connect"]);
  sdb.close();
});

test("audit is append-only", () => {
  const sdb = openServerDb(":memory:");
  audit(sdb, { at: 1, kind: "connect", userId: "u1", deviceId: "d1" });
  audit(sdb, { at: 2, kind: "auth-failed", detail: "bad signature" });
  expect(readAudit(sdb, 10).map((e) => e.kind)).toEqual(["auth-failed", "connect"]);
  expect(readAudit(sdb, 1)[0]).toEqual({
    id: 2,
    at: 2,
    kind: "auth-failed",
    userId: null,
    deviceId: null,
    projectId: null,
    detail: "bad signature",
  });
  expect(() => sdb.db.exec("DELETE FROM audit")).toThrow("append-only");
  expect(() => sdb.db.exec("UPDATE audit SET kind = 'x'")).toThrow("append-only");
  sdb.close();
});
