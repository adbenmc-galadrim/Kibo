import {
  type AgentExecution,
  atRisk,
  type CiRun,
  type CiTone,
  type FeatureState,
  type FeatureStep,
  featureSteps,
  isSprintOver,
  isTerminal,
  nextDeliverableStep,
  type ProjectSnapshot,
  prCiTone,
  type RunView,
  type SprintView,
  sortSprints,
  type TicketView,
} from "@kibo/schema";

export type StepRun = Pick<RunView, "ticketId" | "state" | "agentName" | "startedAt" | "createdAt">;
export type StepSession = { agent: string; minutes: number };
export type StepModel = FeatureStep & { index: number; session: StepSession | null; ci: CiTone | null };
export type StepFacts = {
  runs: readonly StepRun[];
  ciRuns: readonly CiRun[];
  now: number;
  execution: AgentExecution;
};

const minutesSince = (since: number, now: number): number => Math.max(0, Math.floor((now - since) / 60_000));

function sessionOf(ticket: Pick<TicketView, "id" | "session">, facts: StepFacts): StepSession | null {
  if (ticket.session)
    return { agent: ticket.session.tool, minutes: minutesSince(ticket.session.startedAt, facts.now) };
  if (facts.execution !== "shown") return null;
  const run = facts.runs.find((r) => r.ticketId === ticket.id && !isTerminal(r.state));
  return run
    ? { agent: run.agentName, minutes: minutesSince(run.startedAt ?? run.createdAt, facts.now) }
    : null;
}

export function stepModels(
  project: Pick<ProjectSnapshot, "tickets" | "links">,
  featureId: string,
  facts: StepFacts,
): StepModel[] {
  const byId = new Map(project.tickets.map((t) => [t.id, t]));
  return featureSteps({ feature: featureId, tickets: project.tickets, links: project.links }).map((s, i) => ({
    ...s,
    index: i + 1,
    session: sessionOf({ id: s.ticketId, session: byId.get(s.ticketId)?.session ?? null }, facts),
    ci: s.pr ? prCiTone(s.pr, facts.ciRuns) : null,
  }));
}

export const nextStep = <S extends Parameters<typeof nextDeliverableStep>[0][number]>(
  steps: readonly S[],
): S | null => {
  const id = nextDeliverableStep(steps);
  return steps.find((s) => s.ticketId === id) ?? null;
};

export type SprintWarning = { kind: "wontFit" | "over"; remaining: number };
export type SprintFacts = {
  sprint: SprintView | null;
  following: SprintView | null;
  warning: SprintWarning | null;
};

export type SprintClock = { today: string; steps: readonly FeatureStep[] };

function warningOf(sprint: SprintView, state: FeatureState | null, clock: SprintClock): SprintWarning | null {
  if (state === null || state.status === "delivered") return null;
  if (isSprintOver(sprint, clock.today))
    return state.status === "late" ? { kind: "over", remaining: state.remaining } : null;
  return atRisk({ sprint, steps: clock.steps }, clock.today)
    ? { kind: "wontFit", remaining: state.remaining }
    : null;
}

export function sprintFacts(
  project: Pick<ProjectSnapshot, "sprints">,
  feature: Pick<TicketView, "sprintId" | "feature">,
  clock: SprintClock,
): SprintFacts {
  const sorted = sortSprints(project.sprints);
  const index = sorted.findIndex((s) => s.id === feature.sprintId);
  const sprint = sorted[index];
  if (!sprint) return { sprint: null, following: null, warning: null };
  return {
    sprint,
    following: sorted.slice(index + 1).find((s) => s.state !== "done") ?? null,
    warning: warningOf(sprint, feature.feature, clock),
  };
}

export type FeatureBadge = "late" | "open" | "blocked" | "delivered" | null;

export function featureBadge(state: FeatureState | null): FeatureBadge {
  if (!state || state.status === "todo") return null;
  return state.status;
}
