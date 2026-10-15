import { isGroup, LabelName, type TicketView } from "@kibo/schema";

export type KanbanFilter = "mine-and-agents" | "all";

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
  startable = false,
): TicketView[] {
  const byLabel = tickets.filter(
    (t) => !isGroup(t) && (label === null || t.labels.includes(label)) && (!startable || t.startable),
  );
  if (filter === "all") return byLabel;
  return byLabel.filter(
    (t) => t.assignee?.kind === "agent" || (t.assignee?.kind === "human" && t.assignee.ref === viewer),
  );
}
