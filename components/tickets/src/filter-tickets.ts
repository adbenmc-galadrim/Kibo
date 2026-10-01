import type { StatusId, Ticket } from "@kibo/schema";

export type AssigneeFilter = "all" | "me" | "agents" | "nobody";
export type TicketsQuery = { text: string; statuses: ReadonlySet<StatusId>; assignee: AssigneeFilter };

export const EMPTY_QUERY: TicketsQuery = { text: "", statuses: new Set(), assignee: "all" };

export const isActive = (q: TicketsQuery): boolean =>
  q.text.trim() !== "" || q.statuses.size > 0 || q.assignee !== "all";

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const assigneeMatches = (t: Ticket, filter: AssigneeFilter, viewer: string): boolean => {
  if (filter === "me") return t.assignee?.kind === "human" && t.assignee.ref === viewer;
  if (filter === "agents") return t.assignee?.kind === "agent";
  if (filter === "nobody") return t.assignee === null;
  return true;
};

export function filterTickets(tickets: readonly Ticket[], q: TicketsQuery, viewer: string): Set<string> {
  const needle = normalize(q.text.trim());
  const matches = (t: Ticket) =>
    (!needle || normalize(t.title).includes(needle) || normalize(t.key ?? "").includes(needle)) &&
    (q.statuses.size === 0 || q.statuses.has(t.statusId)) &&
    assigneeMatches(t, q.assignee, viewer);
  const parentOf = new Map(tickets.map((t) => [t.id, t.parentId]));
  const visible = new Set<string>();
  for (const t of tickets.filter(matches)) {
    let id: string | null = t.id;
    while (id !== null && !visible.has(id)) {
      visible.add(id);
      id = parentOf.get(id) ?? null;
    }
  }
  return visible;
}
