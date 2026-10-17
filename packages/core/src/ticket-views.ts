import {
  deriveGroups,
  effectiveSprintId,
  type FeatureState,
  featureState,
  featureSteps,
  isOpen,
  isStartable,
  type Link,
  type ProjectActivity,
  type Question,
  type Sprint,
  type StatusId,
  type Ticket,
  type TicketView,
  ticketKeyLabel,
} from "@kibo/schema";
import { openCountByTicket } from "./questions";

export type ViewFacts = {
  projectKey: string;
  tickets: readonly Ticket[];
  links: readonly Link[];
  questions: readonly Question[];
  sprints: readonly Sprint[];
  today: string;
};

const NO_CHILDREN = { done: 0, total: 0 };

function effectiveTickets(
  tickets: readonly Ticket[],
): { ticket: Ticket; progress: TicketView["progress"] }[] {
  const groups = deriveGroups(tickets);
  return tickets.map((ticket) => {
    const group = groups.get(ticket.id);
    if (!group) return { ticket, progress: NO_CHILDREN };
    return {
      ticket: { ...ticket, statusId: group.statusId, blockedReason: null },
      progress: group.progress,
    };
  });
}

function blockersOf(links: readonly Link[]): Map<string, string[]> {
  const blockers = new Map<string, string[]>();
  for (const l of links) if (l.type === "blocks") blockers.set(l.to, [...(blockers.get(l.to) ?? []), l.from]);
  return blockers;
}

function blockingCount(questions: readonly Question[]): Map<string, number> {
  const blocking = new Map<string, number>();
  for (const q of questions) {
    if (q.blocking && isOpen(q)) blocking.set(q.ticketId, (blocking.get(q.ticketId) ?? 0) + 1);
  }
  return blocking;
}

function featureOf(
  facts: ViewFacts,
  effective: readonly Ticket[],
  blocking: ReadonlyMap<string, number>,
): (ticket: Ticket, progress: TicketView["progress"]) => FeatureState | null {
  const sprints = new Map(facts.sprints.map((s) => [s.id, s]));
  const blockingQuestions = new Set(blocking.keys());
  return (ticket, progress) => {
    if (ticket.parentId !== null || progress.total === 0) return null;
    return featureState({
      steps: featureSteps({ feature: ticket.id, tickets: effective, links: facts.links }),
      blockingQuestions,
      sprint: ticket.sprintId === null ? null : (sprints.get(ticket.sprintId) ?? null),
      today: facts.today,
    });
  };
}

export function ticketViews(facts: ViewFacts, activity: ProjectActivity): TicketView[] {
  const effective = effectiveTickets(facts.tickets);
  const byId = new Map(effective.map((e) => [e.ticket.id, e.ticket]));
  const blockers = blockersOf(facts.links);
  const blocking = blockingCount(facts.questions);
  const feature = featureOf(
    facts,
    effective.map((e) => e.ticket),
    blocking,
  );
  const open = openCountByTicket(facts.questions);
  const blockerTickets = (id: string): Ticket[] => (blockers.get(id) ?? []).flatMap((b) => byId.get(b) ?? []);
  const statuses = (list: readonly Ticket[]): StatusId[] => list.map((t) => t.statusId);
  return effective.map(({ ticket: t, progress }) => {
    const before = blockerTickets(t.id);
    return {
      ...t,
      progress,
      waitingOn: before.filter((b) => b.statusId !== "done").map((b) => ticketKeyLabel(b, facts.projectKey)),
      keyLabel: ticketKeyLabel(t, facts.projectKey),
      openQuestions: open.get(t.id) ?? 0,
      effectiveSprintId: effectiveSprintId(t.id, byId),
      feature: feature(t, progress),
      startable:
        progress.total === 0 &&
        isStartable({
          statusId: t.statusId,
          blockerStatuses: statuses(before),
          openBlockingQuestions: blocking.get(t.id) ?? 0,
          busy: activity.busyTickets.has(t.id),
        }),
    };
  });
}
