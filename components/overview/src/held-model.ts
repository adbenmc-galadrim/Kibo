import { heldByReason, type TicketView } from "@kibo/schema";

export type HeldRow = { reason: string; keys: string[]; dependents: number };

export const heldRows = (tickets: readonly TicketView[]): HeldRow[] =>
  heldByReason(tickets).map((group) => ({
    reason: group.reason,
    keys: group.steps.map((step) => step.keyLabel),
    dependents: group.dependents,
  }));

export const heldCount = (rows: readonly HeldRow[]): number =>
  rows.reduce((n, row) => n + row.keys.length, 0);
