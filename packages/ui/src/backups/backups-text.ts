import type { BackupInfo } from "@kibo/schema";
import { frBackups as t } from "../i18n/fr-backups";
import { relativeTime } from "../lib/relative-time";

const HOUR = 3_600_000;

export function sizeLabel(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < t.units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${t.units[unit]}`;
}

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const dayStart = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function lastBackupLine(info: BackupInfo | null, now: number): string {
  if (!info) return t.none;
  const when = now - info.createdAt < 60_000 ? t.justNow : relativeTime(info.createdAt, now);
  return t.last(when, sizeLabel(info.bytes), t.reasons[info.reason]);
}

export function nextBackupLine(nextAt: number, now: number): string {
  if (nextAt - now < HOUR) return t.next(t.soon);
  const days = Math.round((dayStart(nextAt) - dayStart(now)) / (24 * HOUR));
  const time = timeOf(nextAt);
  if (days === 0) return t.next(t.today(time));
  if (days === 1) return t.next(t.tomorrow(time));
  return t.next(
    t.onDate(new Date(nextAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), time),
  );
}

export function backupDateLabel(createdAt: number): string {
  const date = new Date(createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return t.at(date, timeOf(createdAt));
}
