import type { ProjectEvent } from "@kibo/schema";

export function slippedFrom(events: readonly ProjectEvent[], featureId: string): string | null {
  const last = events
    .filter((e) => e.kind === "sprint_set" && e.ticketId === featureId)
    .reduce<ProjectEvent | null>((a, e) => (a === null || e.id > a.id ? e : a), null);
  const from = last?.data.from;
  return typeof from === "string" ? from : null;
}
