import type { FeatureState } from "./feature-state";

type InProgressLevel = "under" | "reached" | "over";
type InProgressFeatures<F> = {
  inProgress: F[];
  count: number;
  limit: number;
  level: InProgressLevel;
  blocked: F[];
};

export const isInProgressFeature = (state: Pick<FeatureState, "started" | "status">): boolean =>
  state.started && state.status !== "delivered";

const levelOf = (count: number, limit: number): InProgressLevel =>
  count < limit ? "under" : count === limit ? "reached" : "over";

export function inProgressFeatures<F extends { state: FeatureState }>(
  features: readonly F[],
  limit: number,
): InProgressFeatures<F> {
  const inProgress = features.filter((f) => isInProgressFeature(f.state));
  return {
    inProgress,
    count: inProgress.length,
    limit,
    level: levelOf(inProgress.length, limit),
    blocked: features.filter((f) => f.state.status === "blocked"),
  };
}
