import { type CiRun, isGroup, LabelName, prCiTone, type TicketView } from "@kibo/schema";
import { inCurrentSprint } from "./sprint-filter";
import { isLivePr, ticketCiRuns, ticketPr } from "./ticket-pr";

export type KanbanFilter = "mine-and-agents" | "all";
export type KanbanFilterKey = "sprint" | "startable" | "toFix";
export const KANBAN_FILTERS: readonly KanbanFilterKey[] = ["sprint", "startable", "toFix"];

export const LABEL_ALL = "*";
export const LABEL_FILTER_KEY = "labelFilter";

export const labelFilterOf = (value: unknown): string | null =>
  typeof value === "string" && LabelName.safeParse(value).success ? value : null;

export const projectLabels = (tickets: readonly TicketView[]): string[] =>
  [...new Set(tickets.flatMap((t) => t.labels))].sort();

export function filterTickets(
  tickets: TicketView[],
  filter: KanbanFilter,
  viewer: string,
  label: string | null = null,
): TicketView[] {
  const byLabel = tickets.filter((t) => !isGroup(t) && (label === null || t.labels.includes(label)));
  if (filter === "all") return byLabel;
  return byLabel.filter(
    (t) => t.assignee?.kind === "agent" || (t.assignee?.kind === "human" && t.assignee.ref === viewer),
  );
}

export function toFix(ticket: Pick<TicketView, "externalRefs">, ciRuns: readonly CiRun[]): boolean {
  const pr = ticketPr(ticket);
  if (pr === null || !isLivePr(pr)) return false;
  return pr.review === "changes_requested" || prCiTone(pr, ciRuns) === "error";
}

export type FilterFacts = { currentSprintId: string | null; ciRuns: readonly CiRun[] };

function matches(ticket: TicketView, filter: KanbanFilterKey, facts: FilterFacts): boolean {
  if (filter === "sprint") return inCurrentSprint(ticket, facts.currentSprintId);
  if (filter === "startable") return ticket.startable;
  return toFix(ticket, ticketCiRuns(ticket, facts.ciRuns));
}

export const inFilters = (
  ticket: TicketView,
  filters: readonly KanbanFilterKey[],
  facts: FilterFacts,
): boolean => filters.every((f) => matches(ticket, f, facts));
