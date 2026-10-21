import {
  type FeatureState,
  type FeatureStep,
  featureSteps,
  isOpen,
  isoWeekday,
  type Link,
  type ProjectMeta,
  type Question,
  type TicketView,
  type TrackingSettings,
} from "@kibo/schema";
import { type CaseTone, stepCaseTone } from "@kibo/sdk/tracking";
import { fr } from "./fr";

export type FeatureFacts = {
  id: string;
  ticket: TicketView;
  shortKey: string;
  title: string;
  sprintId: string | null;
  rank: number;
  state: FeatureState;
  steps: FeatureStep[];
  allSteps: FeatureStep[];
};

export function featureFacts(tickets: readonly TicketView[], links: readonly Link[]): FeatureFacts[] {
  return tickets.flatMap((ticket, rank) => {
    if (ticket.feature === null || ticket.parentId !== null) return [];
    const allSteps = featureSteps({ feature: ticket.id, tickets, links });
    return [
      {
        id: ticket.id,
        ticket,
        shortKey: ticket.shortKey ?? ticket.keyLabel,
        title: ticket.title,
        sprintId: ticket.sprintId,
        rank,
        state: ticket.feature,
        steps: allSteps.filter((s) => s.onHold === null),
        allSteps,
      },
    ];
  });
}

export function rootOf(ticketId: string, byId: ReadonlyMap<string, TicketView>): TicketView | null {
  const seen = new Set<string>();
  let current = byId.get(ticketId) ?? null;
  while (current !== null && current.parentId !== null && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId) ?? current;
  }
  return current;
}

export function featureKeyOf(ticketId: string | null, byId: ReadonlyMap<string, TicketView>): string | null {
  if (ticketId === null) return null;
  return rootOf(ticketId, byId)?.shortKey ?? null;
}

export const questionRef = (q: Question): string => q.importRef?.id ?? q.title;

export function blockingRefs(questions: readonly Question[]): Map<string, string> {
  const refs = new Map<string, string>();
  for (const q of questions)
    if (q.blocking && isOpen(q) && !refs.has(q.ticketId)) refs.set(q.ticketId, questionRef(q));
  return refs;
}

export const stepTone = (
  step: Pick<FeatureStep, "ticketId" | "statusId" | "onHold">,
  blocking: ReadonlyMap<string, string>,
): CaseTone => stepCaseTone(step, blocking.has(step.ticketId));

export const metaOf = (tracking: TrackingSettings | null): ProjectMeta => ({
  id: "",
  key: "",
  name: "",
  folder: null,
  color: "",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking,
  description: null,
  client: null,
});

const parse = (date: string): Date => new Date(`${date}T00:00:00Z`);

export function dayMonth(date: string): string {
  const d = parse(date);
  return `${d.getUTCDate()} ${fr.months[d.getUTCMonth()] ?? ""}`;
}

export const weekdayDayMonth = (date: string): string =>
  `${fr.weekdays[isoWeekday(date) - 1] ?? ""} ${dayMonth(date)}`;

export function sprintDates(start: string, end: string): string {
  const a = parse(start);
  const b = parse(end);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${dayMonth(end)}`;
  return `${dayMonth(start)}–${dayMonth(end)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function duration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MINUTE));
  if (minutes < 60) return fr.now.minutes(minutes);
  return fr.now.hours(Math.floor(minutes / 60), minutes % 60);
}

export function relativeAge(at: number, now: number): string {
  const age = fr.questions.age;
  const ms = Math.max(0, now - at);
  if (ms < MINUTE) return age.now;
  if (ms < HOUR) return age.minutes(Math.floor(ms / MINUTE));
  if (ms < DAY) return age.hours(Math.floor(ms / HOUR));
  const days = Math.floor(ms / DAY);
  return days === 1 ? age.yesterday : age.days(days);
}

const pad = (n: number) => String(n).padStart(2, "0");
export const clockTime = (at: number): string => {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
