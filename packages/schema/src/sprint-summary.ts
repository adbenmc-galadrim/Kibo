import type { FeatureStatus } from "./feature-state";
import type { ProjectSnapshot } from "./rpc";
import { type SprintState, sortSprints } from "./sprint";

export type SprintFeatureSummary = {
  shortKey: string;
  title: string;
  state: FeatureStatus;
  remaining: number;
};
export type SprintSummary = {
  id: string;
  code: string;
  name: string;
  start: string;
  end: string;
  state: SprintState;
  features: SprintFeatureSummary[];
};

export function sprintSummaries(snapshot: Pick<ProjectSnapshot, "sprints" | "tickets">): SprintSummary[] {
  return sortSprints(snapshot.sprints).map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    start: s.start,
    end: s.end,
    state: s.state,
    features: snapshot.tickets.flatMap((t) =>
      t.feature === null || t.sprintId !== s.id
        ? []
        : [
            {
              shortKey: t.shortKey ?? t.keyLabel,
              title: t.title,
              state: t.feature.status,
              remaining: t.feature.remaining,
            },
          ],
    ),
  }));
}
