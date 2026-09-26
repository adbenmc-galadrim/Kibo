import { fr } from "../i18n/fr";

export function relativeTime(then: number, now = Date.now()): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return fr.time.now;
  if (minutes < 60) return fr.time.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return fr.time.hours(hours);
  return fr.time.days(Math.floor(hours / 24));
}
