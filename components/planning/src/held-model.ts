import {
  featureLabel,
  heldByReason,
  isSprintOver,
  type SprintView,
  sortSprints,
  type TicketView,
} from "@kibo/schema";

export type ResumeTarget = Pick<SprintView, "id" | "code" | "name">;
export type HeldStep = {
  ticketId: string;
  key: string;
  title: string;
  featureId: string;
  featureKey: string;
  reason: string;
  since: string;
  resumeTargets: ResumeTarget[];
};
export type HeldGroup = { reason: string; steps: HeldStep[]; dependents: number };

type Facts = {
  byId: ReadonlyMap<string, TicketView>;
  sprints: readonly SprintView[];
  today: string;
};

function featureOf(step: TicketView, byId: ReadonlyMap<string, TicketView>): TicketView {
  const seen = new Set<string>();
  let current = step;
  while (current.parentId !== null && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (parent === undefined) break;
    current = parent;
  }
  return current;
}

function resumeTargets(feature: TicketView, facts: Facts): ResumeTarget[] {
  const sprint = facts.sprints.find((s) => s.id === feature.sprintId);
  if (sprint !== undefined && !isSprintOver(sprint, facts.today)) return [];
  return sortSprints(facts.sprints)
    .filter((s) => !isSprintOver(s, facts.today))
    .map(({ id, code, name }) => ({ id, code, name }));
}

function heldStep(step: TicketView, facts: Facts): HeldStep {
  const feature = featureOf(step, facts.byId);
  return {
    ticketId: step.id,
    key: step.keyLabel,
    title: step.title,
    featureId: feature.id,
    featureKey: featureLabel(feature) || feature.keyLabel,
    reason: step.onHold?.reason ?? "",
    since: step.onHold?.since ?? "",
    resumeTargets: resumeTargets(feature, facts),
  };
}

export function heldGroups(
  tickets: readonly TicketView[],
  sprints: readonly SprintView[],
  today: string,
): HeldGroup[] {
  const facts: Facts = { byId: new Map(tickets.map((t) => [t.id, t])), sprints, today };
  return heldByReason(tickets).map((g) => ({
    reason: g.reason,
    steps: g.steps.map((s) => heldStep(s, facts)),
    dependents: g.dependents,
  }));
}
