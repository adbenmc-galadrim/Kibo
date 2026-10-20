import { isGroup, type Link, type TicketView } from "@kibo/schema";
import type { GraphEdge } from "./critical-path";

export type Assignee = "all" | "mine-and-agents";

const assignedTo = (t: TicketView, assignee: Assignee, viewer: string): boolean =>
  assignee === "all" ||
  isGroup(t) ||
  t.assignee?.kind === "agent" ||
  (t.assignee?.kind === "human" && t.assignee.ref === viewer);

export function graphInput(
  tickets: readonly TicketView[],
  links: readonly Link[],
  assignee: Assignee,
  viewer: string,
): { tickets: TicketView[]; edges: GraphEdge[] } {
  const shown = tickets.filter((t) => t.statusId !== "done" && assignedTo(t, assignee, viewer));
  const ids = new Set(shown.map((t) => t.id));
  const edges = links
    .filter((l) => ids.has(l.from) && ids.has(l.to))
    .map((l): GraphEdge => ({ from: l.from, to: l.to, type: l.type }));
  return { tickets: shown, edges };
}
