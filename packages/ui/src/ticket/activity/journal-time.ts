import { frFeature } from "../../i18n/fr-group";
import { frTicketTracking as t } from "../../i18n/fr-ticket-tracking";
import { clockOf } from "../tracking-model";

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

const midnight = (at: number): number => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function journalTime(at: number, now: number): string {
  const days = Math.round((midnight(now) - midnight(at)) / DAY_MS);
  const d = new Date(at);
  if (days <= 0) return clockOf(at);
  if (days === 1) return `${frFeature.yesterday} ${clockOf(at)}`;
  if (days < WEEK_DAYS) return `${t.weekday(d.getDay())} ${clockOf(at)}`;
  return `${d.getDate()} ${frFeature.month(d.getMonth())} ${clockOf(at)}`;
}
