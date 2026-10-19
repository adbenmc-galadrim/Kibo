import { listTickets } from "@kibo/core";
import type { ProjectCommand } from "@kibo/schema";

export type MockHold = { ticketId: string; reason: string; since: string };

export function applyMockHolds(
  doc: Parameters<typeof listTickets>[0],
  run: (cmd: ProjectCommand) => unknown,
  holds: readonly MockHold[],
): void {
  const tickets = holds.length > 0 ? listTickets(doc) : [];
  for (const { ticketId, reason, since } of holds) {
    const id = tickets.find((t) => t.id === ticketId || t.key === ticketId)?.id ?? ticketId;
    run({ method: "setHold", ticketId: id, reason, since });
  }
}
