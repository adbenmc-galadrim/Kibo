import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKUP_EXCLUDED, readBackups, removeBackupDir, writeBackup } from "./backup-fs";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function home(): string {
  const h = mkdtempSync(join(tmpdir(), "kibo-backup-"));
  dirs.push(h);
  for (const name of [
    "components/src/hello",
    "notes/DEMO",
    "files/DEMO",
    "runs/r1",
    "mcp",
    "remote",
    "tmp",
    "bin",
  ])
    mkdirSync(join(h, name), { recursive: true });
  writeFileSync(join(h, "token"), "secret\n", { mode: 0o600 });
  writeFileSync(join(h, "daemon.json"), "{}");
  writeFileSync(join(h, "components/src/hello/ui.tsx"), "export const x = 1;");
  writeFileSync(join(h, "notes/DEMO/bienvenue.md"), "# Bienvenue");
  writeFileSync(join(h, "files/DEMO/big.glb"), "glTF");
  writeFileSync(join(h, "remote/cert.pem"), "cert");
  return h;
}

function database(h: string, file: string) {
  const db = new Database(join(h, file), { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("CREATE TABLE t(x)");
  db.exec("INSERT INTO t VALUES (1), (2)");
  const vacuumInto = (path: string) => {
    const reader = new Database(join(h, file), { readonly: true, strict: true });
    try {
      reader.run("VACUUM INTO ?", [path]);
    } finally {
      reader.close();
    }
  };
  return { db, entry: { file, vacuumInto } };
}

const input = (h: string, databases: { file: string; vacuumInto(path: string): void }[]) => ({
  home: h,
  dest: join(h, "backups"),
  id: "2026-10-04T14-05-00Z",
  reason: "manual" as const,
  appVersion: "1.5.0",
  now: 10,
  databases,
});

test("a backup copies both databases as consistent snapshots plus components and notes, never secrets", async () => {
  const h = home();
  const kibo = database(h, "kibo.db");
  const runs = database(h, "runs.db");
  const dest = join(h, "backups");
  kibo.db.exec("BEGIN IMMEDIATE");
  kibo.db.exec("INSERT INTO t VALUES (3)");
  const info = await writeBackup(input(h, [kibo.entry, runs.entry]));
  kibo.db.exec("COMMIT");
  const dir = join(dest, info.id);
  const copy = new Database(join(dir, "kibo.db"), { readonly: true });
  expect(copy.query("SELECT count(*) AS n FROM t").get()).toEqual({ n: 2 });
  expect(copy.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
  copy.close();
  expect(existsSync(join(dir, "kibo.db-wal"))).toBe(false);
  expect(existsSync(join(dir, "runs.db"))).toBe(true);
  expect(readFileSync(join(dir, "components/src/hello/ui.tsx"), "utf8")).toBe("export const x = 1;");
  expect(readFileSync(join(dir, "notes/DEMO/bienvenue.md"), "utf8")).toBe("# Bienvenue");
  for (const name of BACKUP_EXCLUDED) expect(existsSync(join(dir, name))).toBe(false);
  expect(statSync(dir).mode & 0o777).toBe(0o700);
  expect(statSync(join(dir, "kibo.db")).mode & 0o777).toBe(0o600);
  expect(statSync(join(dir, "manifest.json")).mode & 0o777).toBe(0o600);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  expect(manifest).toMatchObject({
    id: info.id,
    reason: "manual",
    appVersion: "1.5.0",
    createdAt: 10,
    entries: ["kibo.db", "runs.db", "components", "notes"],
  });
  expect(info.bytes).toBeGreaterThan(0);
  expect(await readBackups(dest)).toEqual([info]);
  await removeBackupDir(dest, info.id);
  expect(existsSync(dir)).toBe(false);
});

test("a link inside components is copied as a link, never followed out of the home", async () => {
  const h = home();
  const outside = mkdtempSync(join(tmpdir(), "kibo-outside-"));
  dirs.push(outside);
  writeFileSync(join(outside, "private.txt"), "private");
  symlinkSync(outside, join(h, "components/src/hello/escape"));
  const info = await writeBackup(input(h, []));
  const link = join(h, "backups", info.id, "components/src/hello/escape");
  expect(lstatSync(link).isSymbolicLink()).toBe(true);
});

test("a failing database leaves neither a partial nor a final folder", async () => {
  const h = home();
  const broken = {
    file: "kibo.db",
    vacuumInto: () => {
      throw new Error("disk full");
    },
  };
  await expect(writeBackup(input(h, [broken]))).rejects.toThrow("disk full");
  expect(readdirSync(join(h, "backups"))).toEqual([]);
});

test("an existing backup is never overwritten", async () => {
  const h = home();
  const kibo = database(h, "kibo.db");
  const first = await writeBackup(input(h, [kibo.entry]));
  const marker = join(h, "backups", first.id, "manifest.json");
  const before = readFileSync(marker, "utf8");
  await expect(writeBackup({ ...input(h, [kibo.entry]), now: 99 })).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(readFileSync(marker, "utf8")).toBe(before);
});

test("a backup id that is not a backup id is refused before touching the disk", async () => {
  const h = home();
  await expect(removeBackupDir(join(h, "backups"), "../token")).rejects.toThrow(/not a backup id/);
  await expect(writeBackup({ ...input(h, []), id: "../x" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(existsSync(join(h, "token"))).toBe(true);
});

test("readBackups ignores folders without a valid manifest", async () => {
  const h = home();
  mkdirSync(join(h, "backups/2026-01-01T00-00-00Z"), { recursive: true });
  writeFileSync(join(h, "backups/2026-01-01T00-00-00Z/manifest.json"), "{ nope");
  mkdirSync(join(h, "backups/random"), { recursive: true });
  mkdirSync(join(h, "backups/2026-01-02T00-00-00Z.partial"), { recursive: true });
  expect(await readBackups(join(h, "backups"))).toEqual([]);
  expect(await readBackups(join(h, "missing"))).toEqual([]);
});
