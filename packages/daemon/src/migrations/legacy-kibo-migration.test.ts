import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_HOME_032 } from "../testing/make-home-0.32";
import { DROPPED_KIBO_TABLES, LEGACY_KIBO_MARKER, migrateLegacyKibo } from "./legacy-kibo-migration";

const NOW = 1_700_000_000_000;
const dirs: string[] = [];
const dbs: Database[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function open(fixture: boolean): Database {
  const home = mkdtempSync(join(tmpdir(), "kibo-legacy-kibo-"));
  dirs.push(home);
  if (fixture) cpSync(FIXTURE_HOME_032, home, { recursive: true });
  const db = new Database(join(home, "kibo.db"), { create: true, strict: true });
  dbs.push(db);
  return db;
}

const tableNames = (db: Database) =>
  (db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
    (r) => r.name,
  );

test("the dead tables and remote sessions go, docs, events, component events and local sessions stay, the marker is set", () => {
  const db = open(true);
  const docs = db.query("SELECT * FROM docs").all();
  const events = db.query("SELECT * FROM project_events").all();
  expect(migrateLegacyKibo(db, () => NOW)).toEqual({
    droppedTables: [...DROPPED_KIBO_TABLES],
    removedRemoteSessions: 1,
  });
  expect(DROPPED_KIBO_TABLES).toEqual(["agent_settings", "file_versions", "component_drafts"]);
  for (const table of DROPPED_KIBO_TABLES) expect(tableNames(db)).not.toContain(table);
  expect(db.query("SELECT count(*) AS n FROM component_events").get()).toEqual({ n: 1 });
  expect(db.query("SELECT * FROM docs").all()).toEqual(docs);
  expect(db.query("SELECT * FROM project_events").all()).toEqual(events);
  expect(db.query("SELECT idHash, remote FROM remote_sessions").all()).toEqual([
    { idHash: "local", remote: 0 },
  ]);
  expect(db.query("SELECT value FROM local_state WHERE key = $key").get({ key: LEGACY_KIBO_MARKER })).toEqual(
    {
      value: String(NOW),
    },
  );
});

test("a second run changes nothing", () => {
  const db = open(true);
  migrateLegacyKibo(db, () => NOW);
  db.exec("CREATE TABLE agent_settings (ref TEXT PRIMARY KEY)");
  expect(migrateLegacyKibo(db, () => NOW + 1)).toBeNull();
  expect(tableNames(db)).toContain("agent_settings");
});

test("an empty database is only marked", () => {
  const db = open(false);
  expect(migrateLegacyKibo(db, () => NOW)).toEqual({ droppedTables: [], removedRemoteSessions: 0 });
  expect(migrateLegacyKibo(db, () => NOW)).toBeNull();
});

test("a failing DROP keeps the remote sessions and sets no marker", () => {
  const db = open(true);
  expect(() => migrateLegacyKibo(db, () => NOW, [...DROPPED_KIBO_TABLES, "sqlite_master"])).toThrow();
  expect(db.query("SELECT count(*) AS n FROM remote_sessions").get()).toEqual({ n: 2 });
  expect(tableNames(db)).toContain("agent_settings");
  expect(
    db.query("SELECT value FROM local_state WHERE key = $key").get({ key: LEGACY_KIBO_MARKER }),
  ).toBeNull();
});
