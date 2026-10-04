import { expect, test } from "bun:test";
import { BACKUP_SETTINGS_DEFAULT, BackupId, BackupInfo, BackupSettings } from "./backup";

test("a backup id is a UTC timestamp usable as a folder name", () => {
  expect(BackupId.safeParse("2026-10-04T14-05-00Z").success).toBe(true);
  expect(BackupId.safeParse("2026-10-04T14:05:00Z").success).toBe(false);
  expect(BackupId.safeParse("../x").success).toBe(false);
});

test("settings default to enabled in the default folder", () => {
  expect(BackupSettings.parse(BACKUP_SETTINGS_DEFAULT)).toEqual({ enabled: true, dir: null });
  expect(
    BackupInfo.safeParse({
      id: "2026-10-04T14-05-00Z",
      createdAt: 1,
      reason: "auto",
      bytes: 10,
      appVersion: "1.5.0",
    }).success,
  ).toBe(true);
  expect(
    BackupInfo.safeParse({
      id: "2026-10-04T14-05-00Z",
      createdAt: 1,
      reason: "nightly",
      bytes: 10,
      appVersion: "1.5.0",
    }).success,
  ).toBe(false);
});
