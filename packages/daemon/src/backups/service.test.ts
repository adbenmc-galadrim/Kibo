import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKUP_EVERY_MS, type Phase7Event } from "@kibo/schema";
import { openRunStore } from "../agents/run-store";
import { openLocalSettings } from "../settings";
import { openStore } from "../store";
import { readBackups } from "./backup-fs";
import { createBackupsService } from "./service";

const DAY = BACKUP_EVERY_MS;
const START = Date.UTC(2026, 9, 4, 12);
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const clean of cleanups.splice(0).reverse()) clean();
});

function setup() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "kibo-backups-")));
  const home = join(root, ".kibo");
  const store = openStore(home);
  const runs = openRunStore(home);
  mkdirSync(join(home, "notes/DEMO"), { recursive: true });
  cleanups.push(() => {
    store.close();
    runs.close();
    rmSync(root, { recursive: true, force: true });
  });
  const clock = { now: START };
  const events: Phase7Event[] = [];
  const service = createBackupsService({
    home,
    userHome: root,
    settings: openLocalSettings(store),
    databases: [
      { file: "kibo.db", vacuumInto: store.vacuumInto },
      { file: "runs.db", vacuumInto: runs.vacuumInto },
    ],
    appVersion: "1.5.0",
    now: () => clock.now,
    emit: (e) => events.push(e),
  });
  return { root, home, clock, events, service };
}

test("tick creates an automatic backup when due, then rotates to seven", async () => {
  const { home, clock, service } = setup();
  for (let i = 0; i < 9; i++) {
    await service.tick();
    await service.tick();
    clock.now += DAY;
  }
  const kept = await readBackups(join(home, "backups"));
  expect(kept).toHaveLength(7);
  expect(kept.every((b) => b.reason === "auto")).toBe(true);
  expect(kept[0]?.createdAt).toBe(START + 2 * DAY);
  expect(kept[6]?.createdAt).toBe(START + 8 * DAY);
});

test("a tick before a day has passed does nothing", async () => {
  const { clock, service } = setup();
  await service.tick();
  clock.now += DAY - 1;
  await service.tick();
  expect(await service.list()).toHaveLength(1);
});

test("a manual backup is never rotated", async () => {
  const { clock, service } = setup();
  const manual = await service.create("manual");
  clock.now += 1000;
  const update = await service.create("update");
  for (let i = 0; i < 9; i++) {
    clock.now += DAY;
    await service.tick();
  }
  const ids = (await service.list()).map((b) => b.id);
  expect(ids).toContain(manual.id);
  expect(ids).toContain(update.id);
  expect(ids).toHaveLength(9);
});

test("create refuses a second backup while one is running", async () => {
  const { clock, service } = setup();
  const first = service.create("manual");
  clock.now += 1000;
  await expect(service.create("update")).rejects.toMatchObject({ code: "CONFLICT" });
  expect((await service.status()).running).toBe(true);
  await first;
  expect((await service.status()).running).toBe(false);
  await expect(service.create("update")).resolves.toMatchObject({ reason: "update" });
});

test("a failed backup releases the lock and leaves nothing behind", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "kibo-backups-")));
  const home = join(root, ".kibo");
  const store = openStore(home);
  cleanups.push(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const service = createBackupsService({
    home,
    userHome: root,
    settings: openLocalSettings(store),
    databases: [
      {
        file: "kibo.db",
        vacuumInto: () => {
          throw new Error("disk full");
        },
      },
    ],
    appVersion: "1.5.0",
    now: () => START,
    emit: () => {},
  });
  await expect(service.create("manual")).rejects.toThrow("disk full");
  expect((await service.status()).running).toBe(false);
  expect(await service.list()).toEqual([]);
});

test("setSettings refuses a folder inside KIBO_HOME, a relative path, a missing folder, and resolves symlinks", async () => {
  const { root, home, service } = setup();
  mkdirSync(join(home, "elsewhere"));
  const invalid = [home, join(home, "elsewhere"), root, "relative/dir", join(root, "missing")];
  for (const dir of invalid)
    await expect(service.setSettings({ dir })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  symlinkSync(home, join(root, "link-to-home"));
  await expect(service.setSettings({ dir: join(root, "link-to-home") })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  const target = realpathSync(mkdtempSync(join(tmpdir(), "kibo-backups-target-")));
  cleanups.push(() => rmSync(target, { recursive: true, force: true }));
  const link = join(root, "link");
  symlinkSync(target, link);
  const status = await service.setSettings({ dir: link });
  expect(status.settings.dir).toBe(target);
  expect(status.dir).toBe(target);
  const info = await service.create("manual");
  expect(existsSync(join(target, info.id, "kibo.db"))).toBe(true);
  const reset = await service.setSettings({ dir: null });
  expect(reset.dir).toBe(join(home, "backups"));
});

test("setSettings { enabled: false } stops tick but create('update') still works", async () => {
  const { service } = setup();
  const status = await service.setSettings({ enabled: false });
  expect(status.settings).toEqual({ enabled: false, dir: null });
  expect(status.nextAt).toBeNull();
  await service.tick();
  expect(await service.list()).toEqual([]);
  await service.create("update");
  expect((await service.list()).map((b) => b.reason)).toEqual(["update"]);
});

test("status exposes the display dir with ~ and the next due time", async () => {
  const { home, clock, service } = setup();
  const empty = await service.status();
  expect(empty).toEqual({
    settings: { enabled: true, dir: null },
    dir: join(home, "backups"),
    displayDir: "~/.kibo/backups",
    last: null,
    nextAt: START,
    running: false,
  });
  const info = await service.create("manual");
  clock.now += 5000;
  const after = await service.status();
  expect(after.last).toEqual(info);
  expect(after.nextAt).toBe(START + DAY);
});

test("every change emits backups.changed", async () => {
  const { clock, events, service } = setup();
  const info = await service.create("manual");
  expect(events).toEqual([{ type: "backups.changed" }, { type: "backups.changed" }]);
  await service.setSettings({ enabled: false });
  expect(events).toHaveLength(3);
  await service.remove(info.id);
  expect(events).toHaveLength(4);
  clock.now += DAY;
  await service.tick();
  expect(events).toHaveLength(4);
  expect(events.every((e) => e.type === "backups.changed")).toBe(true);
});

test("remove refuses an id that is not a backup id", async () => {
  const { home, service } = setup();
  await expect(service.remove("../kibo.db")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(existsSync(join(home, "kibo.db"))).toBe(true);
});
