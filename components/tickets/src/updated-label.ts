import type { TicketView } from "@kibo/schema";
import { fr } from "./fr";

const MINUTE = 60_000;
const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

const dayStart = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const daysBetween = (from: number, to: number): number =>
  Math.round((dayStart(to) - dayStart(from)) / (24 * 60 * MINUTE));

export function updatedLabel(at: number, now: number): string {
  const minutes = Math.floor((now - at) / MINUTE);
  if (minutes < 1) return fr.updated.now;
  if (minutes < 60) return fr.updated.minutes(minutes);
  const days = daysBetween(at, now);
  if (days === 0) return fr.updated.hours(Math.floor(minutes / 60));
  if (days === 1) return fr.updated.yesterday;
  if (days < 7) return WEEKDAY.format(at);
  return DATE.format(at);
}

export const updatedAt = (t: Pick<TicketView, "updatedAt" | "delivery">): number | null =>
  t.updatedAt ?? t.delivery?.at ?? null;
