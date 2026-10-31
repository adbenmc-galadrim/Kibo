import {
  deriveGroups,
  effectiveSprintId,
  type FeatureState,
  featureState,
  featureSteps,
  holdsOf,
  type Link,
  type ProjectActivity,
  type Question,
  type Sprint,
  type Ticket,
  type TicketView,
  ticketKeyLabel,
} from "@kibo/schema";
import { openCountByTicket } from "./questions";
import { firstBlockingQuestions, type HeldTicket, startabilityOf } from "./ticket-start";

type ViewFacts = {
  projectKey: string;
  tickets: readonly Ticket[];
  links: readonly Link[];
  questions: readonly Question[];
  sprints: readonly Sprint[];
  today: string;
  activity: ProjectActivity;
  openLimit: number;
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

function heldTickets(
  effective: readonly { ticket: Ticket; progress: TicketView["progress"] }[],
  facts: ViewFacts,
): { ticket: HeldTicket; progress: TicketView["progress"] }[] {
  const holds = holdsOf(
    effective.map((e) => e.ticket),
    facts.links,
    facts.projectKey,
  );
  return effective.map((e) => ({ ...e, ticket: { ...e.ticket, onHold: holds.get(e.ticket.id) ?? null } }));
}

function blockersOf(links: readonly Link[]): Map<string, string[]> {
  const blockers = new Map<string, string[]>();
  for (const l of links) if (l.type === "blocks") blockers.set(l.to, [...(blockers.get(l.to) ?? []), l.from]);
  return blockers;
}

function featureOf(
  facts: ViewFacts,
  effective: readonly HeldTicket[],
  blocking: ReadonlyMap<string, Question>,
): (ticket: Ticket, progress: TicketView["progress"]) => FeatureState | null {
  const sprints = new Map(facts.sprints.map((s) => [s.id, s]));
  const blockingQuestions = new Set(blocking.keys());
  return (ticket, progress) => {
    if (ticket.parentId !== null || progress.total === 0) return null;
    return featureState({
      steps: featureSteps({ feature: ticket.id, tickets: effective, links: facts.links }),
      featureId: ticket.id,
      blockingQuestions,
      sprint: ticket.sprintId === null ? null : (sprints.get(ticket.sprintId) ?? null),
      today: facts.today,
    });
  };
}

function featureStates(
  effective: readonly { ticket: Ticket; progress: TicketView["progress"] }[],
  feature: (ticket: Ticket, progress: TicketView["progress"]) => FeatureState | null,
): Map<string, FeatureState> {
  const states = new Map<string, FeatureState>();
  for (const { ticket, progress } of effective) {
    const state = feature(ticket, progress);
    if (state !== null) states.set(ticket.id, state);
  }
  return states;
}

export function ticketViews(facts: ViewFacts): TicketView[] {
  const { activity } = facts;
  const effective = heldTickets(effectiveTickets(facts.tickets), facts);
  const byId = new Map(effective.map((e) => [e.ticket.id, e.ticket]));
  const blockers = blockersOf(facts.links);
  const blocking = firstBlockingQuestions(facts.questions);
  const features = featureStates(
    effective,
    featureOf(
      facts,
      effective.map((e) => e.ticket),
      blocking,
    ),
  );
  const startability = startabilityOf({
    projectKey: facts.projectKey,
    today: facts.today,
    openLimit: facts.openLimit,
    sprints: facts.sprints,
    byId,
    links: facts.links,
    features,
    blockingQuestions: blocking,
  });
  const open = openCountByTicket(facts.questions);
  const blockerTickets = (id: string): Ticket[] => (blockers.get(id) ?? []).flatMap((b) => byId.get(b) ?? []);
  return effective.map(({ ticket: t, progress }) => {
    const before = blockerTickets(t.id);
    const start = startability({
      ticket: t,
      isGroup: progress.total > 0,
      blockers: before,
      busy: activity.busyTickets.has(t.id) || activity.sessions.has(t.id),
    });
    return {
      ...t,
      progress,
      waitingOn: before.filter((b) => b.statusId !== "done").map((b) => ticketKeyLabel(b, facts.projectKey)),
      keyLabel: ticketKeyLabel(t, facts.projectKey),
      openQuestions: open.get(t.id) ?? 0,
      effectiveSprintId: effectiveSprintId(t.id, byId),
      feature: features.get(t.id) ?? null,
      session: activity.sessions.get(t.id) ?? null,
      thread: activity.threads.get(t.id) ?? null,
      updatedAt: activity.lastEventAt.get(t.id) ?? t.delivery?.at ?? null,
      startable: start.startable,
      startReason: start.startable ? null : start.reason,
    };
  });
}
