import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, readAudit } from "./audit";
import { immediateTransaction, openServerDb } from "./db";
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

const count = (db: Database) => (db.query("SELECT count(*) AS n FROM t").get() as { n: number }).n;

test("a deferred read-then-write loses to a concurrent writer; an immediate one holds the lock", () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-db-"));
  const file = join(dir, "s.db");
  const sdb = openServerDb(file);
  const a = sdb.db;
  a.exec("CREATE TABLE t (n INTEGER)");
  const b = new Database(file, { strict: true });
  b.exec("PRAGMA busy_timeout = 20");
  const deferred = a.transaction(() => {
    count(a);
    b.query("INSERT INTO t VALUES (1)").run();
    a.query("INSERT INTO t VALUES (2)").run();
  });
  expect(() => deferred()).toThrow(/locked|busy/i);
  expect(count(a)).toBe(1);

  const immediate = immediateTransaction(a, (value: number) => {
    count(a);
    expect(() => b.query("INSERT INTO t VALUES (9)").run()).toThrow(/locked|busy/i);
    a.query("INSERT INTO t VALUES (?)").run(value);
    return count(a);
  });
  expect(immediate(3)).toBe(2);
  expect(count(b)).toBe(2);
  b.close();
  sdb.close();
});

const SOURCES = ["accounts.ts", "members.ts", "room.ts", "market/market-store.ts"];

test("every transaction of kibo-sync goes through immediateTransaction", () => {
  for (const file of SOURCES) {
    const source = readFileSync(join(import.meta.dir, file), "utf8");
    expect({ file, deferred: /\.transaction\(/.test(source) }).toEqual({ file, deferred: false });
    expect({ file, immediate: source.includes("immediateTransaction(") }).toEqual({ file, immediate: true });
  }
});
