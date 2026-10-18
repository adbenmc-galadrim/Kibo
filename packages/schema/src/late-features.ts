import { type Sprint, sprintState } from "./sprint";

export type FeatureView = { id: string; sprintId: string | null; rank: number; remaining: number };

export function lateFeatures<F extends FeatureView>(
  features: readonly F[],
  sprints: readonly Sprint[],
  today: string,
): F[] {
  const endOf = new Map(sprints.filter((s) => sprintState(s, today) === "done").map((s) => [s.id, s.end]));
  const late = features.flatMap((feature) => {
    const end = feature.sprintId === null ? undefined : endOf.get(feature.sprintId);
    return end === undefined || feature.remaining === 0 ? [] : [{ feature, end }];
  });
  return late
    .sort((a, b) => a.end.localeCompare(b.end) || a.feature.rank - b.feature.rank)
    .map((l) => l.feature);
}
