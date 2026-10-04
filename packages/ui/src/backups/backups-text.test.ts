import { expect, test } from "bun:test";
import type { BackupInfo } from "@kibo/schema";
import { backupDateLabel, lastBackupLine, nextBackupLine, sizeLabel } from "./backups-text";

const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).getTime();
const info = (createdAt: number, reason: BackupInfo["reason"], bytes = 12_400_000): BackupInfo => ({
  id: "2026-10-04T12-05-00Z",
  createdAt,
  reason,
  bytes,
  appVersion: "1.5.0",
});

test("sizes are decimal, in French, with one decimal at most", () => {
  expect(sizeLabel(12_400_000)).toBe("12,4 Mo");
  expect(sizeLabel(512)).toBe("512 o");
  expect(sizeLabel(48_000)).toBe("48 ko");
  expect(sizeLabel(2_150_000_000)).toBe("2,2 Go");
});

test("the last backup line says when, how big and why", () => {
  const now = at(4, 16, 5);
  expect(lastBackupLine(null, now)).toBe("Aucune sauvegarde pour l'instant");
  expect(lastBackupLine(info(at(4, 14, 5), "auto"), now)).toBe(
    "Dernière sauvegarde il y a 2 h · 12,4 Mo · automatique",
  );
  expect(lastBackupLine(info(now, "manual"), now)).toBe(
    "Dernière sauvegarde à l'instant · 12,4 Mo · manuelle",
  );
  expect(lastBackupLine(info(at(3, 9, 0), "update"), now)).toContain("avant mise à jour");
});

test("the next backup is told as today, tomorrow or a date, and soon when already due", () => {
  const now = at(4, 16, 5);
  expect(nextBackupLine(at(5, 14, 5), now)).toBe("Prochaine : demain à 14:05");
  expect(nextBackupLine(at(4, 18, 30), now)).toBe("Prochaine : aujourd'hui à 18:30");
  expect(nextBackupLine(at(8, 9, 0), now)).toBe("Prochaine : le 8 oct. à 09:00");
  expect(nextBackupLine(at(4, 10, 0), now)).toBe("Prochaine : dans moins d'une heure");
});

test("a backup row reads as a local date", () => {
  expect(backupDateLabel(at(4, 14, 5))).toBe("4 oct. 2026 à 14:05");
});
