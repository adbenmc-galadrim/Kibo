import type { Link, TicketView } from "@kibo/schema";
import type { GraphEdge } from "./critical-path";

export type GraphFilter = {
  assignee: "mine-and-agents" | "all";
  hideDone: boolean;
  domain: string | null;
};

const visible = (t: TicketView, f: GraphFilter, viewer: string): boolean =>
  (f.assignee === "all" ||
    t.assignee?.kind === "agent" ||
    (t.assignee?.kind === "human" && t.assignee.ref === viewer)) &&
  (!f.hideDone || t.statusId !== "done") &&
  (f.domain === null || t.domainId === f.domain);

export function graphInput(
  tickets: TicketView[],
  links: Link[],
  f: GraphFilter,
  viewer: string,
): { tickets: TicketView[]; edges: GraphEdge[] } {
  const shown = tickets.filter((t) => visible(t, f, viewer));
  const ids = new Set(shown.map((t) => t.id));
  const edges = links
    .filter((l) => ids.has(l.from) && ids.has(l.to))
    .map((l): GraphEdge => ({ from: l.from, to: l.to, type: l.type }));
  return { tickets: shown, edges };
}

export const domainsOf = (tickets: TicketView[]): string[] =>
  [...new Set(tickets.flatMap((t) => (t.domainId ? [t.domainId] : [])))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
