import type { StatusId, Ticket } from "@kibo/schema";

export type AssigneeFilter = "all" | "me" | "agents" | "nobody";
export type TicketsQuery = {
  text: string;
  statuses: ReadonlySet<StatusId>;
  assignee: AssigneeFilter;
  labels: ReadonlySet<string>;
};

export const EMPTY_QUERY: TicketsQuery = {
  text: "",
  statuses: new Set(),
  assignee: "all",
  labels: new Set(),
};

export const isActive = (q: TicketsQuery): boolean =>
  q.text.trim() !== "" || q.statuses.size > 0 || q.assignee !== "all" || q.labels.size > 0;

export const projectLabels = (tickets: readonly Ticket[]): string[] =>
  [...new Set(tickets.flatMap((t) => t.labels))].sort();

const labelsMatch = (t: Ticket, chosen: ReadonlySet<string>): boolean =>
  [...chosen].every((l) => t.labels.includes(l));

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const assigneeMatches = (t: Ticket, filter: AssigneeFilter, viewer: string): boolean => {
  if (filter === "me") return t.assignee?.kind === "human" && t.assignee.ref === viewer;
  if (filter === "agents") return t.assignee?.kind === "agent";
  if (filter === "nobody") return t.assignee === null;
  return true;
};

export type FilteredTree = { visible: Set<string>; context: Set<string> };

export function filterTree(tickets: readonly Ticket[], q: TicketsQuery, viewer: string): FilteredTree {
  const needle = normalize(q.text.trim());
  const matches = (t: Ticket) =>
    (!needle || normalize(t.title).includes(needle) || normalize(t.key ?? "").includes(needle)) &&
    (q.statuses.size === 0 || q.statuses.has(t.statusId)) &&
    assigneeMatches(t, q.assignee, viewer) &&
    labelsMatch(t, q.labels);
  const parentOf = new Map(tickets.map((t) => [t.id, t.parentId]));
  const matched = new Set(tickets.filter(matches).map((t) => t.id));
  const visible = new Set<string>();
  for (const matchId of matched) {
    let id: string | null = matchId;
    while (id !== null && !visible.has(id)) {
      visible.add(id);
      id = parentOf.get(id) ?? null;
    }
  }
  return { visible, context: new Set([...visible].filter((id) => !matched.has(id))) };
}

export const filterTickets = (tickets: readonly Ticket[], q: TicketsQuery, viewer: string): Set<string> =>
  filterTree(tickets, q, viewer).visible;
