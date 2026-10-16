import { isGroup, type TicketView } from "@kibo/schema";
import { inSprint, sortTickets, type TicketsQuery } from "./filter-tickets";

export type TicketSections = {
  open: TicketView[];
  done: TicketView[];
  loose: TicketView[];
  features: TicketView[];
  tickets: number;
};

type SectionsInput = {
  tickets: readonly TicketView[];
  sprint: string;
  query: TicketsQuery;
  mine: string | null;
};

export function featureOf(tickets: readonly TicketView[]): (ticket: TicketView) => TicketView | null {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  return (ticket) => {
    const seen = new Set<string>();
    let at = ticket;
    while (at.parentId !== null && !seen.has(at.parentId)) {
      seen.add(at.parentId);
      const parent = byId.get(at.parentId);
      if (!parent) return null;
      at = parent;
    }
    return at.id === ticket.id ? null : at;
  };
}

const isStep = (t: TicketView) => t.parentId !== null && !isGroup(t);
const isLoose = (t: TicketView) => t.parentId === null && !isGroup(t);
const assignedTo = (t: TicketView, viewer: string) =>
  t.assignee?.kind === "human" && t.assignee.ref === viewer;

export function buildSections({ tickets, sprint, query, mine }: SectionsInput): TicketSections {
  const rootOf = featureOf(tickets);
  const scoped = tickets.filter((t) => inSprint(t, sprint) && (mine === null || assignedTo(t, mine)));
  const steps = scoped.filter(isStep);
  const features = [...new Set(steps.map((t) => rootOf(t)).filter((f) => f !== null))];
  const shown = steps.filter((t) => query.featureId === null || rootOf(t)?.id === query.featureId);
  const loose = query.featureId === null ? scoped.filter(isLoose) : [];
  return {
    open: sortTickets(
      shown.filter((t) => t.statusId !== "done"),
      query.sort,
    ),
    done: query.openOnly
      ? []
      : sortTickets(
          shown.filter((t) => t.statusId === "done"),
          query.sort,
        ),
    loose: sortTickets(
      loose.filter((t) => !query.openOnly || t.statusId !== "done"),
      query.sort,
    ),
    features: sortTickets(features, "key"),
    tickets: steps.length,
  };
}

export function withAncestors(tickets: TicketView[], ids: readonly string[]): ReadonlySet<string> {
  const parentOf = new Map(tickets.map((t) => [t.id, t.parentId]));
  const kept = new Set<string>();
  for (const id of ids) {
    let at: string | null = id;
    while (at !== null && !kept.has(at)) {
      kept.add(at);
      at = parentOf.get(at) ?? null;
    }
  }
  return kept;
}
