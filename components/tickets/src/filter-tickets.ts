import type { SprintView, TicketView } from "@kibo/schema";
import { sortSprints } from "@kibo/schema";

export const ALL_SPRINTS = "all";
export const NO_SPRINT = "none";

export type TicketsSort = "recent" | "key";
export type TicketsQuery = { openOnly: boolean; featureId: string | null; sort: TicketsSort };

export const EMPTY_QUERY: TicketsQuery = { openOnly: false, featureId: null, sort: "recent" };

export const isActive = (q: TicketsQuery): boolean => q.openOnly || q.featureId !== null;

export function currentSprintOf(sprints: readonly SprintView[]): SprintView | null {
  return sortSprints(sprints.filter((s) => s.state === "current")).at(-1) ?? null;
}

export function chosenSprint(saved: unknown, sprints: readonly SprintView[]): string {
  if (saved === ALL_SPRINTS || saved === NO_SPRINT) return saved;
  if (typeof saved === "string" && sprints.some((s) => s.id === saved)) return saved;
  return currentSprintOf(sprints)?.id ?? ALL_SPRINTS;
}

export type SprintRef = SprintView & { code?: string };

export const sprintCode = (s: SprintRef): string => s.code ?? s.name;

export const inSprint = (t: Pick<TicketView, "effectiveSprintId">, sprint: string): boolean => {
  if (sprint === ALL_SPRINTS) return true;
  if (sprint === NO_SPRINT) return t.effectiveSprintId === null;
  return t.effectiveSprintId === sprint;
};

export const updatedAt = (t: Pick<TicketView, "delivery">): number | null => t.delivery?.at ?? null;

const byKey = (a: TicketView, b: TicketView): number =>
  a.keyLabel.localeCompare(b.keyLabel, "fr", { numeric: true });

const byRecent = (a: TicketView, b: TicketView): number => {
  const at = updatedAt(a);
  const bt = updatedAt(b);
  if (at === bt) return byKey(a, b);
  if (at === null) return 1;
  if (bt === null) return -1;
  return bt - at;
};

export const sortTickets = (tickets: readonly TicketView[], sort: TicketsSort): TicketView[] =>
  [...tickets].sort(sort === "recent" ? byRecent : byKey);
