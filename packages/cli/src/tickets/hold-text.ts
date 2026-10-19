import type { OnHold } from "@kibo/schema";
import { frTickets } from "../fr";

const DAY = /^\d{4}-(\d{2})-(\d{2})$/;

export function dayText(day: string): string {
  const match = DAY.exec(day);
  const month = frTickets.hold.months[Number(match?.[1]) - 1];
  return match === null || month === undefined ? day : `${Number(match[2])} ${month}`;
}

export const holdLine = (onHold: OnHold): string =>
  onHold.source === "own"
    ? frTickets.hold.line(onHold.reason, frTickets.hold.since(dayText(onHold.since)))
    : frTickets.hold.of(onHold.key);
