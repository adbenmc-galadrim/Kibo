import type { Lane } from "@kibo/component-graph/models";

const COLUMN_MARGIN = 16;
const COLUMN_GAP = 16;
const COLUMN_PEEK = 24;

export const COLUMN_WIDTH = `calc(100% - ${COLUMN_GAP + COLUMN_PEEK - COLUMN_MARGIN}px)`;

export function startLane(lanes: readonly Lane[]): string | null {
  const current = lanes.find((l) => l.state === "current") ?? lanes.find((l) => l.state === "planned");
  const latest = [...lanes].reverse().find((l) => l.code !== null);
  return (current ?? latest ?? lanes[0])?.id ?? null;
}

export function visibleLanes(lanes: readonly Lane[], filter: string | null): readonly Lane[] {
  const chosen = lanes.filter((l) => l.id === filter);
  return chosen.length > 0 ? chosen : lanes;
}
