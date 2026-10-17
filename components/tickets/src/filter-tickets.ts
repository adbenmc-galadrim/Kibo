import type { SprintView, StatusId, Ticket, TicketView } from "@kibo/schema";
import { sortSprints } from "@kibo/schema";
import { updatedAt } from "./updated-label";

export const ALL_SPRINTS = "all";
export const NO_SPRINT = "none";

export type TicketsSort = "recent" | "key";
export type AssigneeFilter = "all" | "me" | "agents" | "nobody";
export type TicketsQuery = {
  openOnly: boolean;
  featureId: string | null;
  sort: TicketsSort;
  text: string;
  statuses: ReadonlySet<StatusId>;
  assignee: AssigneeFilter;
  labels: ReadonlySet<string>;
  startable: boolean;
};

export const EMPTY_QUERY: TicketsQuery = {
  openOnly: false,
  featureId: null,
  sort: "recent",
  text: "",
  statuses: new Set(),
  assignee: "all",
  labels: new Set(),
  startable: false,
};

export const narrowsOpen = (q: TicketsQuery): boolean =>
  q.openOnly || q.statuses.size > 0 || q.assignee !== "all" || q.startable;

export const isActive = (q: TicketsQuery): boolean =>
  narrowsOpen(q) || q.featureId !== null || q.text.trim() !== "" || q.labels.size > 0;

export const cleared = (q: TicketsQuery): TicketsQuery => ({ ...EMPTY_QUERY, sort: q.sort });

export const projectLabels = (tickets: readonly Ticket[]): string[] =>
  [...new Set(tickets.flatMap((t) => t.labels))].sort();

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const assigneeMatches = (t: Ticket, filter: AssigneeFilter, viewer: string): boolean => {
  if (filter === "me") return t.assignee?.kind === "human" && t.assignee.ref === viewer;
  if (filter === "agents") return t.assignee?.kind === "agent";
  if (filter === "nobody") return t.assignee === null;
  return true;
};

export function matchesQuery(t: TicketView, q: TicketsQuery, viewer: string): boolean {
  const needle = normalize(q.text.trim());
  return (
    (!needle || normalize(t.title).includes(needle) || normalize(t.keyLabel).includes(needle)) &&
    (q.statuses.size === 0 || q.statuses.has(t.statusId)) &&
    assigneeMatches(t, q.assignee, viewer) &&
    [...q.labels].every((l) => t.labels.includes(l)) &&
    (!q.startable || t.startable)
  );
}

export const filterTickets = (tickets: readonly TicketView[], q: TicketsQuery, viewer: string): Set<string> =>
  new Set(tickets.filter((t) => matchesQuery(t, q, viewer)).map((t) => t.id));

export function currentSprintOf(sprints: readonly SprintView[]): SprintView | null {
  return sortSprints(sprints.filter((s) => s.state === "current")).at(-1) ?? null;
}

export function chosenSprint(saved: unknown, sprints: readonly SprintView[]): string {
  if (saved === ALL_SPRINTS || saved === NO_SPRINT) return saved;
  if (typeof saved === "string" && sprints.some((s) => s.id === saved)) return saved;
  return currentSprintOf(sprints)?.id ?? ALL_SPRINTS;
}

export const inSprint = (t: Pick<TicketView, "effectiveSprintId">, sprint: string): boolean => {
  if (sprint === ALL_SPRINTS) return true;
  if (sprint === NO_SPRINT) return t.effectiveSprintId === null;
  return t.effectiveSprintId === sprint;
};

const byKey = (a: TicketView, b: TicketView): number =>
  a.keyLabel.localeCompare(b.keyLabel, "fr", { numeric: true });

const byRecent = (a: TicketView, b: TicketView): number => {
  const at = updatedAt(a);
  const bt = updatedAt(b);
  if (at === bt) return byKey(a, b);
  if (at === null) return 1;
  if (bt === null) return -1;
  return bt - at;
};

export const sortTickets = (tickets: readonly TicketView[], sort: TicketsSort): TicketView[] =>
  [...tickets].sort(sort === "recent" ? byRecent : byKey);
