import type { Sprint } from "@kibo/schema";
import { fr } from "./fr";

export const sprintCodeOf = (sprint: Sprint): string =>
  "code" in sprint && typeof sprint.code === "string" ? sprint.code : "";

export const sprintLabel = (sprint: Sprint): string => `${sprintCodeOf(sprint)} ${sprint.name}`.trim();

const parse = (date: string): Date => new Date(`${date}T00:00:00Z`);

const dayMonth = (d: Date) => ({ day: d.getUTCDate(), month: fr.months[d.getUTCMonth()] ?? "" });

export function sprintDates(start: string, end: string): string {
  const a = dayMonth(parse(start));
  const b = dayMonth(parse(end));
  if (a.month === b.month) return `${a.day}–${b.day} ${b.month}`;
  return `${a.day} ${a.month}–${b.day} ${b.month}`;
}
