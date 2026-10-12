import type { AgentsState } from "@kibo/schema";
import type { OverlapStore } from "./store";

export type OverlapAggregates = Required<Pick<AgentsState, "overlaps" | "overlapTotal">>;

export const overlapAggregates = (
  store: Pick<OverlapStore, "openCountByRun" | "openTotal">,
): OverlapAggregates => ({
  overlaps: store.openCountByRun(),
  overlapTotal: store.openTotal(),
});

export function withOverlapCounts<P extends { state(): AgentsState }>(
  port: P,
  counts: () => OverlapAggregates,
): P {
  return { ...port, state: () => ({ ...port.state(), ...counts() }) };
}
