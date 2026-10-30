import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openProjectAgentStore } from "../project-agent/store";
import { openWakeupStore } from "../project-agent/wakeup/store";
import { openRunStore } from "../runs/run-store";
import { FIXTURE_HOME_021 } from "../testing/make-home-0.21";
import { FIXTURE_032, FIXTURE_HOME_032 } from "../testing/make-home-0.32";
import { runLegacyMigrations } from "./legacy";
import { LEGACY_KIBO_MARKER } from "./legacy-kibo-migration";
import { LEGACY_RUNS_MARKER } from "./legacy-runs-migration";

const NOW = Date.UTC(2026, 9, 30, 8, 15, 42);
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function homeFrom(fixture: string | null): string {
  const home = mkdtempSync(join(tmpdir(), "kibo-legacy-"));
  dirs.push(home);
  if (fixture) cpSync(fixture, home, { recursive: true });
  return home;
}

function query(home: string, file: string, sql: string): unknown[] {
  const db = new Database(join(home, file), { readonly: true });
  try {
    return db.query(sql).all();
  } finally {
    db.close();
  }
}

const backups = (home: string) =>
  existsSync(join(home, "backups")) ? readdirSync(join(home, "backups")) : [];

function projectAgentHistory(home: string) {
  const runs = openRunStore(home);
  const agent = openProjectAgentStore(home);
  const wakeups = openWakeupStore(home);
  try {
    return {
      runs: runs.records(),
      events: runs.events(),
      tokens: FIXTURE_032.projectRuns.map((id) => runs.tokenHash(id)),
      sessions: agent.sessions(FIXTURE_032.projectId),
      batches: agent.batches("p2"),
      wakeup: wakeups.wakeup(FIXTURE_032.projectId),
      answers: wakeups.queuedAnswers(FIXTURE_032.projectId),
    };
  } finally {
    wakeups.close();
    agent.close();
    runs.close();
  }
}

test("a 0.32 home is saved, then loses its ticket runs and keeps the project agent history", () => {
  const home = homeFrom(FIXTURE_HOME_032);
  const before = projectAgentHistory(home);
  expect(before.batches[0]?.actions.map((a) => a.type)).toEqual(["setStatus", "assignAgent"]);
  const lines: string[] = [];
  runLegacyMigrations(
    home,
    () => NOW,
    (line) => lines.push(line),
  );
  expect(backups(home)).toEqual(["2026-10-30T08-15-42Z-avant-retrait"]);
  expect(query(home, "runs.db", "SELECT id FROM runs ORDER BY seq")).toEqual([{ id: "p1" }, { id: "p2" }]);
  expect(projectAgentHistory(home)).toEqual(before);
  for (const id of FIXTURE_032.ticketRuns) expect(existsSync(join(home, "runs", id))).toBe(false);
  for (const id of FIXTURE_032.projectRuns) expect(existsSync(join(home, "runs", id))).toBe(true);
  expect(lines).toHaveLength(3);
});

test("both WAL databases are compacted after a migration that removed rows", () => {
  const home = homeFrom(FIXTURE_HOME_032);
  for (const file of ["kibo.db", "runs.db"]) {
    const db = new Database(join(home, file));
    db.exec("PRAGMA journal_mode = WAL");
    db.close();
  }
  const size = (file: string) => statSync(join(home, file)).size;
  const before = { runs: size("runs.db"), kibo: size("kibo.db") };
  runLegacyMigrations(
    home,
    () => NOW,
    () => {},
  );
  expect(size("runs.db")).toBeLessThan(before.runs);
  expect(size("kibo.db")).toBeLessThan(before.kibo);
});

test("a failing VACUUM is logged with its code and keeps the migration", () => {
  const home = homeFrom(FIXTURE_HOME_032);
  const lines: string[] = [];
  const vacuum = () => {
    throw new Error("disk full");
  };
  runLegacyMigrations(
    home,
    () => NOW,
    (line) => lines.push(line),
    vacuum,
  );
  expect(lines.filter((line) => line.includes("VACUUM_FAILED"))).toHaveLength(2);
  expect(query(home, "runs.db", "SELECT id FROM runs ORDER BY seq")).toEqual([{ id: "p1" }, { id: "p2" }]);
  expect(
    query(home, "runs.db", "SELECT key FROM host_settings WHERE key = 'ticket_runs_removed_at'"),
  ).toHaveLength(1);
  expect(
    query(home, "kibo.db", "SELECT key FROM local_state WHERE key = 'legacy_tables_dropped_at'"),
  ).toHaveLength(1);
});

test("a new home is not compacted", () => {
  const home = homeFrom(null);
  const vacuumed: string[] = [];
  runLegacyMigrations(
    home,
    () => NOW,
    () => {},
    (file) => vacuumed.push(file),
  );
  expect(vacuumed).toEqual([]);
});

test("a second start neither saves nor migrates again", () => {
  const home = homeFrom(FIXTURE_HOME_032);
  runLegacyMigrations(
    home,
    () => NOW,
    () => {},
  );
  const lines: string[] = [];
  runLegacyMigrations(
    home,
    () => NOW + 60_000,
    (line) => lines.push(line),
  );
  expect(backups(home)).toHaveLength(1);
  expect(lines).toEqual([]);
});

test("a 0.21 home keeps its project run r4", () => {
  const home = homeFrom(FIXTURE_HOME_021);
  runLegacyMigrations(
    home,
    () => NOW,
    () => {},
  );
  expect(query(home, "runs.db", "SELECT id, kind FROM runs")).toEqual([{ id: "r4", kind: "project" }]);
  const runs = openRunStore(home);
  expect(runs.records().map((r) => r.id)).toEqual(["r4"]);
  runs.close();
  expect(backups(home)).toHaveLength(1);
});

test("a new home is marked without a backup", () => {
  const home = homeFrom(null);
  runLegacyMigrations(
    home,
    () => NOW,
    () => {},
  );
  expect(backups(home)).toEqual([]);
  expect(query(home, "runs.db", "SELECT key FROM host_settings")).toEqual([{ key: LEGACY_RUNS_MARKER }]);
  expect(query(home, "kibo.db", "SELECT key FROM local_state")).toEqual([{ key: LEGACY_KIBO_MARKER }]);
});

test("an unwritable backups folder logs BACKUP_FAILED and nothing is migrated", () => {
  const home = homeFrom(FIXTURE_HOME_032);
  writeFileSync(join(home, "backups"), "");
  const lines: string[] = [];
  runLegacyMigrations(
    home,
    () => NOW,
    (line) => lines.push(line),
  );
  expect(lines).toEqual([expect.stringContaining("BACKUP_FAILED")]);
  expect(query(home, "runs.db", "SELECT count(*) AS n FROM runs WHERE kind = 'ticket'")).toEqual([{ n: 4 }]);
  expect(query(home, "kibo.db", "SELECT count(*) AS n FROM agent_settings")).toEqual([{ n: 1 }]);
  for (const id of FIXTURE_032.ticketRuns) expect(existsSync(join(home, "runs", id))).toBe(true);
});
