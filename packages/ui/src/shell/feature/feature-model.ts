import {
  type FeatureState,
  type FeatureStep,
  featureSteps,
  isTerminal,
  NOT_STARTED_STATUSES,
  type ProjectSnapshot,
  type RunView,
  type SprintView,
  sortSprints,
  type TicketView,
} from "@kibo/schema";

export type StepRun = Pick<RunView, "ticketId" | "state" | "agentName" | "startedAt" | "createdAt">;
export type StepSession = { agent: string; minutes: number };
export type StepModel = FeatureStep & { index: number; session: StepSession | null };

const sessionOf = (runs: readonly StepRun[], ticketId: string, now: number): StepSession | null => {
  const run = runs.find((r) => r.ticketId === ticketId && !isTerminal(r.state));
  if (!run) return null;
  const since = run.startedAt ?? run.createdAt;
  return { agent: run.agentName, minutes: Math.max(0, Math.floor((now - since) / 60_000)) };
};

export function stepModels(
  project: Pick<ProjectSnapshot, "tickets" | "links">,
  featureId: string,
  runs: readonly StepRun[],
  now: number,
): StepModel[] {
  return featureSteps({ feature: featureId, tickets: project.tickets, links: project.links }).map((s, i) => ({
    ...s,
    index: i + 1,
    session: sessionOf(runs, s.ticketId, now),
  }));
}

export const nextToDeliver = <S extends Pick<FeatureStep, "statusId">>(steps: readonly S[]): S | null =>
  steps.find((s) => NOT_STARTED_STATUSES.includes(s.statusId)) ?? null;

export type SprintWarning = { kind: "wontFit" | "over"; remaining: number };
export type SprintFacts = {
  sprint: SprintView | null;
  following: SprintView | null;
  warning: SprintWarning | null;
};

function warningOf(sprint: SprintView, state: FeatureState | null, today: string): SprintWarning | null {
  if (!state || state.remaining === 0) return null;
  if (sprint.state === "done") return { kind: "over", remaining: state.remaining };
  if (state.status === "late" || sprint.end <= today) return { kind: "wontFit", remaining: state.remaining };
  return null;
}

export function sprintFacts(
  project: Pick<ProjectSnapshot, "sprints">,
  feature: Pick<TicketView, "sprintId" | "feature">,
  today: string,
): SprintFacts {
  const sorted = sortSprints(project.sprints);
  const index = sorted.findIndex((s) => s.id === feature.sprintId);
  const sprint = sorted[index];
  if (!sprint) return { sprint: null, following: null, warning: null };
  return {
    sprint,
    following: sorted.slice(index + 1).find((s) => s.state !== "done") ?? null,
    warning: warningOf(sprint, feature.feature, today),
  };
}

export type FeatureBadge = "late" | "open" | "blocked" | "delivered" | null;

export function featureBadge(state: FeatureState | null, warning: SprintWarning | null): FeatureBadge {
  if (!state) return null;
  if (state.status === "delivered") return "delivered";
  if (state.status === "blocked") return "blocked";
  if (state.status === "late" || warning !== null) return "late";
  return state.status === "open" ? "open" : null;
}
