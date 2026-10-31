import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BackupInfo } from "@kibo/schema";
import { readBackups } from "../backups/backup-fs";
import { toRotate } from "../backups/rotate";
import { FIXTURE_HOME_032 } from "../testing/make-home-0.32";
import { backupBeforeMigration } from "./legacy-backup";

const AT = new Date(Date.UTC(2026, 9, 30, 8, 15, 42));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixtureHome(): string {
  const home = mkdtempSync(join(tmpdir(), "kibo-legacy-backup-"));
  dirs.push(home);
  cpSync(FIXTURE_HOME_032, home, { recursive: true });
  return home;
}

function failure(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
}

const count = (file: string, sql: string) => {
  const db = new Database(file, { readonly: true });
  try {
    return (db.query(sql).get() as { n: number }).n;
  } finally {
    db.close();
  }
};

test("the backup holds both databases, a manifest with reason migration, and is not rotated", async () => {
  const home = fixtureHome();
  const backup = backupBeforeMigration(home, () => AT);
  expect(backup).toEqual({
    dir: join(home, "backups", "2026-10-30T08-15-42Z-avant-retrait"),
    files: ["kibo.db", "runs.db"],
  });
  expect(readdirSync(join(home, "backups"))).toEqual(["2026-10-30T08-15-42Z-avant-retrait"]);
  expect(count(join(backup.dir, "runs.db"), "SELECT count(*) AS n FROM runs WHERE kind = 'ticket'")).toBe(4);
  expect(count(join(backup.dir, "kibo.db"), "SELECT count(*) AS n FROM agent_settings")).toBe(1);
  const manifest = BackupInfo.parse(JSON.parse(readFileSync(join(backup.dir, "manifest.json"), "utf8")));
  expect(manifest).toMatchObject({
    id: "2026-10-30T08-15-42Z-avant-retrait",
    reason: "migration",
    createdAt: AT.getTime(),
  });
  const listed = await readBackups(join(home, "backups"));
  expect(listed.map((b) => b.id)).toEqual([manifest.id]);
  expect(toRotate(listed, 0)).toEqual([]);
});

test("a closed WAL database, without its -shm file, is saved", () => {
  const home = fixtureHome();
  for (const file of ["kibo.db", "runs.db"]) {
    const db = new Database(join(home, file));
    db.exec("PRAGMA journal_mode = WAL");
    db.close();
  }
  expect(existsSync(join(home, "runs.db-shm"))).toBe(false);
  const backup = backupBeforeMigration(home, () => AT);
  expect(count(join(backup.dir, "runs.db"), "SELECT count(*) AS n FROM runs")).toBe(6);
});

test("a partial folder left by an interrupted attempt is replaced", () => {
  const home = fixtureHome();
  const partial = join(home, "backups", "2026-10-30T08-15-42Z-avant-retrait.partial");
  mkdirSync(partial, { recursive: true });
  writeFileSync(join(partial, "runs.db"), "");
  const backup = backupBeforeMigration(home, () => AT);
  expect(readdirSync(join(home, "backups"))).toEqual(["2026-10-30T08-15-42Z-avant-retrait"]);
  expect(count(join(backup.dir, "runs.db"), "SELECT count(*) AS n FROM runs")).toBe(6);
});

test("only the databases that exist are saved", () => {
  const home = fixtureHome();
  rmSync(join(home, "kibo.db"));
  const backup = backupBeforeMigration(home, () => AT);
  expect(backup.files).toEqual(["runs.db"]);
  expect(existsSync(join(backup.dir, "kibo.db"))).toBe(false);
});

test("an unwritable backups folder throws BACKUP_FAILED", () => {
  const home = fixtureHome();
  writeFileSync(join(home, "backups"), "");
  expect(failure(() => backupBeforeMigration(home, () => AT))).toMatchObject({ code: "BACKUP_FAILED" });
});

test("a failing copy removes the partial folder", () => {
  const home = fixtureHome();
  writeFileSync(join(home, "runs.db"), "not a database");
  expect(failure(() => backupBeforeMigration(home, () => AT))).toMatchObject({ code: "BACKUP_FAILED" });
  expect(readdirSync(join(home, "backups"))).toEqual([]);
});
