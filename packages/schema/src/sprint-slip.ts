import type { ProjectEvent } from "./project-event";
import type { Sprint } from "./sprint";

type SprintStart = Pick<Sprint, "code" | "start">;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function localDay(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

function beforeStart(e: ProjectEvent, from: string, sprints: readonly SprintStart[]): boolean {
  const origin = sprints.find((s) => s.code === from);
  return origin !== undefined && localDay(e.at) < origin.start;
}

export function sprintOrigins(
  events: readonly ProjectEvent[],
  featureId: string,
  sprints: readonly SprintStart[],
): string[] {
  const moves = events
    .filter((e) => e.kind === "sprint_set" && e.ticketId === featureId)
    .sort((a, b) => a.id - b.id);
  return moves.reduce<string[]>((origins, e) => {
    const from = e.data.from;
    if (typeof from !== "string") return [];
    if (beforeStart(e, from, sprints)) return origins;
    return [...origins.filter((o) => o !== from), from];
  }, []);
}

export const slippedFrom = (
  events: readonly ProjectEvent[],
  featureId: string,
  sprints: readonly SprintStart[],
): string | null => sprintOrigins(events, featureId, sprints).at(-1) ?? null;
