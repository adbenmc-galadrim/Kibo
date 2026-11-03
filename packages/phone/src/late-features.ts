import { featureStateOn, type ProjectSnapshot } from "@kibo/schema";

export function redated(snapshot: ProjectSnapshot, today: string): ProjectSnapshot {
  if (!snapshot.tickets.some((t) => t.feature)) return snapshot;
  const ends = new Map(snapshot.sprints.map((s) => [s.id, s]));
  return {
    ...snapshot,
    tickets: snapshot.tickets.map((t) => {
      if (!t.feature) return t;
      const sprint = t.sprintId === null ? null : (ends.get(t.sprintId) ?? null);
      const feature = featureStateOn(t.feature, sprint, today);
      return feature === t.feature ? t : { ...t, feature };
    }),
  };
}
