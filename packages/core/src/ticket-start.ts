import {
  type FeatureState,
  isInProgressFeature,
  isOpen,
  type Question,
  type Sprint,
  type Startability,
  type StartContext,
  type StartFacts,
  startable,
  type Ticket,
  ticketKeyLabel,
} from "@kibo/schema";

export type StartSource = {
  projectKey: string;
  today: string;
  openLimit: number;
  sprints: readonly Sprint[];
  byId: ReadonlyMap<string, Ticket>;
  features: ReadonlyMap<string, FeatureState>;
  blockingQuestions: ReadonlyMap<string, Question>;
};
export type StartCandidate = { ticket: Ticket; isGroup: boolean; blockers: readonly Ticket[]; busy: boolean };

const GROUP: Startability = { startable: false, reason: { kind: "status" } };

export function firstBlockingQuestions(questions: readonly Question[]): Map<string, Question> {
  const first = new Map<string, Question>();
  for (const q of questions) if (q.blocking && isOpen(q) && !first.has(q.ticketId)) first.set(q.ticketId, q);
  return first;
}

function rootFinder(byId: ReadonlyMap<string, Ticket>): (id: string) => string | null {
  const roots = new Map<string, string | null>();
  const find = (id: string, seen: Set<string>): string | null => {
    const known = roots.get(id);
    if (known !== undefined) return known;
    const ticket = byId.get(id);
    if (ticket === undefined || seen.has(id)) return null;
    seen.add(id);
    const root = ticket.parentId === null ? id : find(ticket.parentId, seen);
    roots.set(id, root);
    return root;
  };
  return (id) => find(id, new Set());
}

export function startabilityOf(source: StartSource): (candidate: StartCandidate) => Startability {
  const sprints = new Map(source.sprints.map((s) => [s.id, s]));
  const inProgress = new Set<string>();
  for (const [id, state] of source.features) if (isInProgressFeature(state)) inProgress.add(id);
  const ctx: StartContext = { today: source.today, limit: source.openLimit, inProgressFeatures: inProgress };
  const rootOf = rootFinder(source.byId);
  const featureOf = (ticketId: string): StartFacts["feature"] => {
    const rootId = rootOf(ticketId);
    if (rootId === null || !source.features.has(rootId)) return null;
    const sprintId = source.byId.get(rootId)?.sprintId ?? null;
    return { id: rootId, sprint: sprintId === null ? null : (sprints.get(sprintId) ?? null) };
  };
  return ({ ticket, isGroup, blockers, busy }) => {
    if (isGroup) return GROUP;
    return startable(
      {
        statusId: ticket.statusId,
        busy,
        blockers: blockers.map((b) => ({ key: ticketKeyLabel(b, source.projectKey), statusId: b.statusId })),
        blockingQuestion: source.blockingQuestions.get(ticket.id) ?? null,
        feature: featureOf(ticket.id),
      },
      ctx,
    );
  };
}
