import { frFeature as t } from "../../i18n/fr-group";

const DAY_MS = 86_400_000;
const pad = (n: number): string => String(n).padStart(2, "0");

const midnight = (at: number): number => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const daysBetween = (at: number, now: number): number => Math.round((midnight(now) - midnight(at)) / DAY_MS);

const clock = (at: number): string => {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const dayMonth = (at: number): string => {
  const d = new Date(at);
  return `${d.getDate()} ${t.month(d.getMonth())}`;
};

export function stepTime(at: number, now: number): string {
  const days = daysBetween(at, now);
  if (days === 0) return clock(at);
  if (days === 1) return `${t.yesterday} ${clock(at)}`;
  return `${dayMonth(at)} ${clock(at)}`;
}

export function shortTime(at: number, now: number): string {
  const days = daysBetween(at, now);
  if (days === 0) return clock(at);
  if (days === 1) return t.yesterday;
  return dayMonth(at);
}

export function ageLabel(at: number, now: number): string {
  const days = daysBetween(at, now);
  if (days <= 0) return t.today;
  if (days === 1) return t.yesterday;
  return t.daysAgo(days);
}

const parts = (day: string): { day: number; month: number; year: number } => {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return { day: date, month: month - 1, year };
};

export function dateRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.month === b.month && a.year === b.year) return `${a.day}–${b.day} ${t.month(b.month)}`;
  return `${a.day} ${t.month(a.month)}–${b.day} ${t.month(b.month)}`;
}
