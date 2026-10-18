import {
  addDays,
  DAY_MS,
  dayNumber,
  type IsoDate,
  isoWeekday,
  type SprintView,
  type TicketView,
} from "@kibo/schema";
import { fr } from "./fr";

export type ClientImpact = { feature: string; week: IsoDate | null };
export type ClientTicket = Pick<TicketView, "id" | "title" | "parentId" | "shortKey" | "effectiveSprintId">;

const t = fr.clientText;
const WEEK_DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };

export const clientWeek = (date: IsoDate): string =>
  new Intl.DateTimeFormat("fr-FR", WEEK_DAY).format(dayNumber(date) * DAY_MS);

export const impactLine = (q: { blocking: boolean }, impact: ClientImpact): string =>
  `${q.blocking ? t.blocks(impact.feature) : t.for(impact.feature)}, ${
    impact.week === null ? t.unplanned : t.planned(clientWeek(impact.week))
  }`;

function rootOf<T extends ClientTicket>(ticket: T, ticketOf: (id: string) => T | null): T {
  const seen = new Set<string>([ticket.id]);
  let current = ticket;
  for (let parent = current.parentId; parent !== null && !seen.has(parent); parent = current.parentId) {
    const next = ticketOf(parent);
    if (next === null) return current;
    seen.add(next.id);
    current = next;
  }
  return current;
}

const mondayOf = (date: IsoDate): IsoDate => addDays(date, 1 - isoWeekday(date));

export function clientImpact<T extends ClientTicket>(
  ticket: T,
  ticketOf: (id: string) => T | null,
  sprints: readonly Pick<SprintView, "id" | "start">[],
): ClientImpact {
  const sprint = sprints.find((s) => s.id === ticket.effectiveSprintId);
  return {
    feature: rootOf(ticket, ticketOf).title,
    week: sprint === undefined ? null : mondayOf(sprint.start),
  };
}
