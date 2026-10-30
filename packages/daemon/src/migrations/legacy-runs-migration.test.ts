import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_032, FIXTURE_HOME_032 } from "../testing/make-home-0.32";
import {
  DROPPED_RUNS_TABLES,
  LEGACY_RUNS_MARKER,
  migrateLegacyRuns,
  removeLegacyRunDirs,
} from "./legacy-runs-migration";

const NOW = 1_700_000_000_000;
const dirs: string[] = [];
const dbs: Database[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixtureHome(): string {
  const home = mkdtempSync(join(tmpdir(), "kibo-legacy-runs-"));
  dirs.push(home);
  cpSync(FIXTURE_HOME_032, home, { recursive: true });
  return home;
}

function open(home: string): Database {
  const db = new Database(join(home, "runs.db"), { strict: true });
  dbs.push(db);
  return db;
}

const count = (db: Database, sql: string) => (db.query(sql).get() as { n: number }).n;
const tableNames = (db: Database) =>
  (db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
    (r) => r.name,
  );
const snapshot = (db: Database) => ({
  runs: db.query("SELECT * FROM runs ORDER BY seq").all(),
  events: db.query("SELECT * FROM run_events ORDER BY id").all(),
  tokens: db.query("SELECT * FROM run_tokens ORDER BY id").all(),
  tables: tableNames(db).sort(),
});

test("ticket runs and their rows go, project runs and their history stay", () => {
  const db = open(fixtureHome());
  const projectBefore = {
    runs: db.query("SELECT * FROM runs WHERE kind = 'project' ORDER BY seq").all(),
    events: db.query("SELECT * FROM run_events WHERE run_id IN ('p1', 'p2') ORDER BY id").all(),
    tokens: db.query("SELECT * FROM run_tokens WHERE run_id IN ('p1', 'p2') ORDER BY id").all(),
    sessions: db.query("SELECT * FROM project_agent_sessions").all(),
    batches: db.query("SELECT * FROM project_agent_batches").all(),
    wakeups: db.query("SELECT * FROM project_agent_wakeups").all(),
    answers: db.query("SELECT * FROM project_agent_wakeup_answers").all(),
  };
  const result = migrateLegacyRuns(db, () => NOW);
  expect(result).toEqual({
    removedRuns: 4,
    removedRunIds: [...FIXTURE_032.ticketRuns].sort(),
    droppedTables: [...DROPPED_RUNS_TABLES],
  });
  expect(count(db, "SELECT count(*) AS n FROM runs WHERE kind = 'ticket'")).toBe(0);
  expect(count(db, "SELECT count(*) AS n FROM run_events")).toBe(FIXTURE_032.eventsOfProjectRuns);
  expect({
    runs: db.query("SELECT * FROM runs ORDER BY seq").all(),
    events: db.query("SELECT * FROM run_events ORDER BY id").all(),
    tokens: db.query("SELECT * FROM run_tokens ORDER BY id").all(),
    sessions: db.query("SELECT * FROM project_agent_sessions").all(),
    batches: db.query("SELECT * FROM project_agent_batches").all(),
    wakeups: db.query("SELECT * FROM project_agent_wakeups").all(),
    answers: db.query("SELECT * FROM project_agent_wakeup_answers").all(),
  }).toEqual(projectBefore);
  for (const table of DROPPED_RUNS_TABLES) expect(tableNames(db)).not.toContain(table);
  expect(() => db.run("DELETE FROM runs WHERE id = 'p1'")).toThrow(/append-only/);
  expect(() => db.run("DELETE FROM run_events")).toThrow(/append-only/);
  expect(() => db.run("DELETE FROM run_tokens")).toThrow(/append-only/);
  expect(() => db.run("DELETE FROM project_agent_batches")).toThrow(/append-only/);
  expect(
    db.query("SELECT value FROM host_settings WHERE key = $key").get({ key: LEGACY_RUNS_MARKER }),
  ).toEqual({
    value: JSON.stringify(String(NOW)),
  });
});

test("a second run changes nothing", () => {
  const db = open(fixtureHome());
  migrateLegacyRuns(db, () => NOW);
  const after = snapshot(db);
  expect(migrateLegacyRuns(db, () => NOW + 1)).toBeNull();
  expect(snapshot(db)).toEqual(after);
});

test("a database without any ticket run is marked and loses only the dead tables", () => {
  const db = open(fixtureHome());
  migrateLegacyRuns(db, () => NOW);
  db.query("DELETE FROM host_settings WHERE key = $key").run({ key: LEGACY_RUNS_MARKER });
  db.exec("CREATE TABLE run_moments (id INTEGER PRIMARY KEY)");
  const before = snapshot(db);
  expect(migrateLegacyRuns(db, () => NOW)).toEqual({
    removedRuns: 0,
    removedRunIds: [],
    droppedTables: ["run_moments"],
  });
  expect(snapshot(db)).toEqual({ ...before, tables: before.tables.filter((t) => t !== "run_moments") });
});

test("an empty database is only marked", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-legacy-runs-"));
  dirs.push(home);
  const db = open(home);
  expect(migrateLegacyRuns(db, () => NOW)).toEqual({ removedRuns: 0, removedRunIds: [], droppedTables: [] });
  expect(migrateLegacyRuns(db, () => NOW)).toBeNull();
});

test("the deletion is one transaction: a failing DROP leaves the ticket runs in place", () => {
  const db = open(fixtureHome());
  const before = snapshot(db);
  expect(() => migrateLegacyRuns(db, () => NOW, [...DROPPED_RUNS_TABLES, "sqlite_master"])).toThrow();
  expect(snapshot(db)).toEqual(before);
  expect(
    db.query("SELECT value FROM host_settings WHERE key = $key").get({ key: LEGACY_RUNS_MARKER }),
  ).toBeNull();
  expect(() => db.run("DELETE FROM runs WHERE id = 't-run-1'")).toThrow(/append-only/);
});

test("the folders of removed runs are erased, the others stay", () => {
  const home = fixtureHome();
  removeLegacyRunDirs(home, [...FIXTURE_032.ticketRuns, "../kibo.db", ""]);
  for (const id of FIXTURE_032.ticketRuns) expect(existsSync(join(home, "runs", id))).toBe(false);
  for (const id of FIXTURE_032.projectRuns) expect(existsSync(join(home, "runs", id))).toBe(true);
  expect(existsSync(join(home, "kibo.db"))).toBe(true);
});
