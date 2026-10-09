import type { Link, ProjectSnapshot, RunView, TicketCard, TicketSheet, TicketView } from "@kibo/schema";
import { answerText, assigneeOf, branchOf, prOf, ticketKeyOf } from "./ticket-facts";

export function ticketCard(project: ProjectSnapshot, ticket: TicketView): TicketCard {
  return {
    key: ticket.keyLabel,
    title: ticket.title,
    statusId: ticket.statusId,
    labels: [...ticket.labels],
    assignee: assigneeOf(ticket),
    parent: ticket.parentId === null ? null : ticketKeyOf(project, ticket.parentId),
    openQuestions: ticket.openQuestions,
    branch: branchOf(ticket.externalRefs),
    pr: prOf(ticket.externalRefs),
  };
}

const keysOf = (project: ProjectSnapshot, links: readonly Link[], side: (l: Link) => string): string[] =>
  links.map((l) => ticketKeyOf(project, side(l)));

export function ticketSheet(
  project: ProjectSnapshot,
  ticket: TicketView,
  runs: readonly RunView[],
): TicketSheet {
  const blocks = project.links.filter((l) => l.type === "blocks");
  const relates = project.links.filter(
    (l) => l.type === "relates" && (l.from === ticket.id || l.to === ticket.id),
  );
  return {
    ...ticketCard(project, ticket),
    description: ticket.description,
    blockedReason: ticket.blockedReason,
    blocks: keysOf(
      project,
      blocks.filter((l) => l.from === ticket.id),
      (l) => l.to,
    ),
    blockedBy: keysOf(
      project,
      blocks.filter((l) => l.to === ticket.id),
      (l) => l.from,
    ),
    relates: keysOf(project, relates, (l) => (l.from === ticket.id ? l.to : l.from)),
    questions: project.questions
      .filter((q) => q.ticketId === ticket.id)
      .map((q) => ({
        id: q.id,
        title: q.title,
        state: q.answer === null ? ("open" as const) : ("answered" as const),
        answer: answerText(q),
      })),
    runs: runs
      .filter((r) => r.ticketId === ticket.id)
      .map((r) => ({ id: r.id, label: r.label, state: r.state, turns: r.turns })),
  };
}
