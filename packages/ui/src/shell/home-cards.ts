import {
  blockedCount,
  currentSprint,
  isFeature,
  openCount,
  overviewIndicators,
  type ProjectMeta,
  type ProjectSnapshot,
} from "@kibo/schema";

export type HomeCounts = {
  open: number;
  blocked: number;
  late: number;
  sprint: string | null;
  done: number;
  total: number;
};
export type HomeCard = Pick<ProjectMeta, "id" | "key" | "name" | "color" | "client"> & {
  counts: HomeCounts | null;
};

function countsOf(snapshot: ProjectSnapshot, today: string): HomeCounts {
  const work = snapshot.tickets.filter((t) => !isFeature(t));
  const open = openCount(work);
  return {
    open,
    blocked: blockedCount(work, snapshot.questions),
    late: overviewIndicators({ snapshot, today }).features.late,
    sprint: currentSprint(snapshot.sprints, today)?.code ?? null,
    done: work.length - open,
    total: work.length,
  };
}

export function homeCard(
  project: ProjectMeta,
  snapshot: ProjectSnapshot | undefined,
  today: string,
): HomeCard {
  const { id, key, name, color, client } = snapshot?.meta ?? project;
  return { id, key, name, color, client, counts: snapshot === undefined ? null : countsOf(snapshot, today) };
}
