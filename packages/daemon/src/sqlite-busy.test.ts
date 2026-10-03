import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { immediateTransaction } from "./sqlite-busy";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function twoConnections(): { a: Database; b: Database } {
  const dir = mkdtempSync(join(tmpdir(), "kibo-busy-"));
  dirs.push(dir);
  const file = join(dir, "t.db");
  const a = new Database(file, { create: true, strict: true });
  a.exec("PRAGMA journal_mode = WAL");
  a.exec("CREATE TABLE t (n INTEGER)");
  const b = new Database(file, { strict: true });
  b.exec("PRAGMA busy_timeout = 20");
  return { a, b };
}

const count = (db: Database) => (db.query("SELECT count(*) AS n FROM t").get() as { n: number }).n;

test("a deferred read-then-write loses to a concurrent writer; an immediate one holds the lock", () => {
  const { a, b } = twoConnections();
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
});

const SOURCES = [
  "store.ts",
  "agents/run-store.ts",
  "integrations/db.ts",
  "components/events.ts",
  "collab/sync-db.ts",
  "market/market-db.ts",
  "notes/index.ts",
];

test("every transaction of the daemon goes through immediateTransaction", () => {
  for (const file of SOURCES) {
    const source = readFileSync(join(import.meta.dir, file), "utf8");
    expect({ file, deferred: /\.transaction\(/.test(source) }).toEqual({ file, deferred: false });
    expect({ file, immediate: source.includes("immediateTransaction(") }).toEqual({ file, immediate: true });
  }
});
