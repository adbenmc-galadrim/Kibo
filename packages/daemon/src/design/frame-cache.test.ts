import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { migrateIntegrations } from "../integrations/db";
import { createFrameCache, type FrameCache } from "./frame-cache";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
let home: string;
let db: Database;
let cache: FrameCache;
const clock = { now: 1_000_000 };
const put = (id: string, body = PNG, fetchedAt = clock.now) =>
  cache.put({
    id,
    provider: "figma",
    name: id,
    width: 10,
    height: 10,
    mime: "image/png",
    version: "v1",
    fetchedAt,
    body,
  });

beforeEach(() => {
  clock.now = 1_000_000;
  home = mkdtempSync(join(tmpdir(), "kibo-design-"));
  db = new Database(join(home, "kibo.db"), { create: true, strict: true });
  migrateIntegrations(db);
  cache = createFrameCache({ db, home, now: () => clock.now, maxBytes: 64, maxTotal: 30 });
});
afterEach(() => {
  db.close();
  rmSync(home, { recursive: true, force: true });
});

test("a frame is written under cache/design with mode 0600 and read back", () => {
  const row = put("figma:A/1:2");
  expect(row.path.startsWith(join(home, "cache", "design"))).toBe(true);
  expect(readFileSync(row.path)).toEqual(Buffer.from(PNG));
  expect(statSync(row.path).mode & 0o777).toBe(0o600);
  expect(statSync(join(home, "cache", "design")).mode & 0o777).toBe(0o700);
  expect(cache.get("figma:A/1:2")).toMatchObject({
    name: "figma:A/1:2",
    version: "v1",
    bytes: PNG.length,
    mime: "image/png",
  });
  expect(cache.get("figma:B/1:2")).toBeNull();
});

test("the file name never comes from the frame id", () => {
  const row = put("figma:../../etc/1:2");
  expect(row.path).toMatch(/[/\\]cache[/\\]design[/\\][0-9a-f]{64}\.png$/);
});

test("a body that does not match its mime is refused", () => {
  expect(() =>
    cache.put({
      id: "x",
      provider: "figma",
      name: "x",
      width: null,
      height: null,
      mime: "image/webp",
      version: null,
      fetchedAt: 0,
      body: PNG,
    }),
  ).toThrow("INVALID_INPUT");
  expect(cache.get("x")).toBeNull();
});

test("a missing file on disk makes the row disappear", () => {
  const row = put("figma:A/1:2");
  rmSync(row.path);
  expect(cache.get("figma:A/1:2")).toBeNull();
  expect(db.query("SELECT count(*) AS n FROM design_cache").get()).toEqual({ n: 0 });
});

test("too large is refused, the total is bounded by evicting the least recently used", () => {
  expect(() => put("big", new Uint8Array(65))).toThrow("TOO_LARGE");
  put("a");
  clock.now += 10;
  put("b");
  clock.now += 10;
  cache.touch("a", null);
  clock.now += 10;
  put("c");
  expect(cache.totalBytes()).toBeLessThanOrEqual(30);
  expect(cache.get("b")).toBeNull();
  expect(cache.get("a")).not.toBeNull();
});

test("touch refreshes fetched_at when asked, purge drops idle rows and their files", () => {
  const row = put("a", PNG, 5);
  cache.touch("a", 42);
  expect(cache.get("a")?.fetchedAt).toBe(42);
  clock.now += 91 * 86_400_000;
  expect(cache.purge()).toBe(1);
  expect(existsSync(row.path)).toBe(false);
});

test("remove drops the row and the file", () => {
  const row = put("a");
  cache.remove("a");
  expect(existsSync(row.path)).toBe(false);
  expect(cache.get("a")).toBeNull();
  cache.remove("a");
});

test("the legacy figma cache folder is removed when the cache is built", () => {
  mkdirSync(join(home, "cache", "figma", "AbC123"), { recursive: true });
  writeFileSync(join(home, "cache", "figma", "AbC123", "1:2.png"), PNG);
  createFrameCache({ db, home, now: () => clock.now });
  expect(existsSync(join(home, "cache", "figma"))).toBe(false);
});

test("the legacy figma cache table is dropped by the migration", () => {
  db.exec(
    "CREATE TABLE IF NOT EXISTS figma_cache (file_key TEXT NOT NULL, node_id TEXT NOT NULL, png_path TEXT NOT NULL, fetched_at INTEGER NOT NULL, PRIMARY KEY (file_key, node_id))",
  );
  migrateIntegrations(db);
  const tables = db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  expect(tables.map((t) => t.name)).not.toContain("figma_cache");
});

test("a failed write leaves neither a temporary nor an orphan file", () => {
  put("a");
  db.exec(
    "CREATE TRIGGER refuse BEFORE INSERT ON design_cache WHEN NEW.frame_id = 'b' BEGIN SELECT RAISE(ABORT, 'refused'); END",
  );
  expect(() => put("b")).toThrow("refused");
  expect(readdirSync(join(home, "cache", "design"))).toEqual([basename(cache.get("a")?.path ?? "")]);
});

test("rewriting a frame replaces its file in place, without a temporary left behind", () => {
  const first = put("a");
  const next = Uint8Array.from([...PNG, 9]);
  const second = put("a", next);
  expect(second.path).toBe(first.path);
  expect(readFileSync(second.path)).toEqual(Buffer.from(next));
  expect(readdirSync(join(home, "cache", "design"))).toHaveLength(1);
});
