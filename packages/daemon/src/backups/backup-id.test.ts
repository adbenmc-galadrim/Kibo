import { expect, test } from "bun:test";
import { BackupId } from "@kibo/schema";
import { backupIdAt, backupTime } from "./backup-id";

test("ids are UTC, second precision, filesystem safe and sortable", () => {
  const id = backupIdAt(Date.UTC(2026, 9, 4, 14, 5, 0, 999));
  expect(id).toBe("2026-10-04T14-05-00Z");
  expect(BackupId.safeParse(id).success).toBe(true);
  expect(backupTime(id)).toBe(Date.UTC(2026, 9, 4, 14, 5, 0));
  expect(backupIdAt(1) < backupIdAt(2_000)).toBe(true);
});
