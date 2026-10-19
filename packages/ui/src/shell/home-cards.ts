import {
  atRisk,
  blockedCount,
  currentSprint,
  featureSteps,
  isFeature,
  openCount,
  overviewIndicators,
  type ProjectMeta,
  type ProjectSnapshot,
  type SprintView,
} from "@kibo/schema";

export type HomeCounts = {
  open: number;
  blocked: number;
  late: number;
  risk: number;
  sprint: string | null;
  done: number;
  total: number;
};
export type HomeCard = Pick<ProjectMeta, "id" | "key" | "name" | "color" | "client"> & {
  counts: HomeCounts | null;
};

const activeSteps = <S extends { onHold: unknown }>(steps: readonly S[]): S[] =>
  steps.filter((s) => s.onHold === null);

function atRiskCount(snapshot: ProjectSnapshot, sprint: SprintView | null, today: string): number {
  if (sprint === null) return 0;
  const { tickets, links } = snapshot;
  return tickets.filter(
    (t) =>
      t.feature !== null &&
      t.sprintId === sprint.id &&
      t.feature.status !== "delivered" &&
      atRisk({ sprint, steps: activeSteps(featureSteps({ feature: t.id, tickets, links })) }, today),
  ).length;
}

function countsOf(snapshot: ProjectSnapshot, today: string): HomeCounts {
  const work = snapshot.tickets.filter((t) => !isFeature(t));
  const open = openCount(work);
  const sprint = currentSprint(snapshot.sprints, today);
  return {
    open,
    blocked: blockedCount(work, snapshot.questions),
    late: overviewIndicators({ snapshot, today }).features.late,
    risk: atRiskCount(snapshot, sprint, today),
    sprint: sprint?.code ?? null,
    done: work.length - open,
    total: work.length,
  };
}

export function homeCard(
  project: ProjectMeta,
  snapshot: ProjectSnapshot | undefined,
  today: string | null,
): HomeCard {
  const { id, key, name, color, client } = snapshot?.meta ?? project;
  const counts = snapshot === undefined || today === null ? null : countsOf(snapshot, today);
  return { id, key, name, color, client, counts };
}
