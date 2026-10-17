import type { StatusId } from "./status";
import type { TicketSession } from "./ticket-session";

export const NOT_STARTED_STATUSES: readonly StatusId[] = ["backlog", "todo"];
export const FINAL_STATUSES: readonly StatusId[] = ["done"];

export type StartableInput = {
  statusId: StatusId;
  blockerStatuses: readonly StatusId[];
  openBlockingQuestions: number;
  busy: boolean;
};

export function isStartable(i: StartableInput): boolean {
  return (
    NOT_STARTED_STATUSES.includes(i.statusId) &&
    i.blockerStatuses.every((s) => FINAL_STATUSES.includes(s)) &&
    i.openBlockingQuestions === 0 &&
    !i.busy
  );
}

export type ProjectActivity = {
  busyTickets: ReadonlySet<string>;
  sessions: ReadonlyMap<string, TicketSession>;
  lastEventAt: ReadonlyMap<string, number>;
};
export const NO_ACTIVITY: ProjectActivity = {
  busyTickets: new Set(),
  sessions: new Map(),
  lastEventAt: new Map(),
};
