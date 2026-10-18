import type { ProjectEvent } from "./project-event";

export function sprintOrigins(events: readonly ProjectEvent[], featureId: string): string[] {
  const moves = events
    .filter((e) => e.kind === "sprint_set" && e.ticketId === featureId)
    .sort((a, b) => a.id - b.id);
  return moves.reduce<string[]>((origins, e) => {
    const from = e.data.from;
    return typeof from === "string" ? [...origins.filter((o) => o !== from), from] : [];
  }, []);
}

export const slippedFrom = (events: readonly ProjectEvent[], featureId: string): string | null =>
  sprintOrigins(events, featureId).at(-1) ?? null;
