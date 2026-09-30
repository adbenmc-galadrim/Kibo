import type { Link, ProjectSnapshot, TicketView } from "@kibo/schema";

export type LinkedTicket = { link: Link; ticket: TicketView };
export type TicketLinks = { blockedBy: LinkedTicket[]; blocks: LinkedTicket[]; related: LinkedTicket[] };

const MAX_CANDIDATES = 8;

export function linksOf(project: ProjectSnapshot, ticketId: string): TicketLinks {
  const byId = new Map(project.tickets.map((t) => [t.id, t]));
  const other = (link: Link) => byId.get(link.from === ticketId ? link.to : link.from);
  const out: TicketLinks = { blockedBy: [], blocks: [], related: [] };
  for (const link of project.links) {
    if (link.from !== ticketId && link.to !== ticketId) continue;
    const ticket = other(link);
    if (!ticket) continue;
    if (link.type === "relates") out.related.push({ link, ticket });
    else if (link.to === ticketId) out.blockedBy.push({ link, ticket });
    else out.blocks.push({ link, ticket });
  }
  return out;
}

export function linkCandidates(project: ProjectSnapshot, ticketId: string, query: string): TicketView[] {
  const linked = new Set(
    project.links.flatMap((l) => (l.from === ticketId ? [l.to] : l.to === ticketId ? [l.from] : [])),
  );
  const q = query.trim().toLowerCase();
  const byKey = (t: TicketView) => t.keyLabel.toLowerCase().includes(q);
  const byTitle = (t: TicketView) => t.title.toLowerCase().includes(q);
  return project.tickets
    .filter((t) => t.id !== ticketId && !linked.has(t.id))
    .filter((t) => q === "" || byKey(t) || byTitle(t))
    .sort((a, b) => Number(byKey(b)) - Number(byKey(a)))
    .slice(0, MAX_CANDIDATES);
}
