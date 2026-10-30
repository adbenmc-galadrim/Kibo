import { isFeature, type SprintView, sortSprints, type TicketView } from "@kibo/schema";
import { findSprint } from "./find-sprint";

export type SprintRef = { id: string; code: string; name: string };
export type FeatureRef = { key: string; shortKey: string | null; title: string };
export type TrackingFields = { sprint: SprintRef | null; feature: FeatureRef | null; optional: boolean };
export type SprintSource = Pick<SprintView, "id" | "code" | "name" | "state" | "start" | "end">;
type SprintSelector = (t: Pick<TrackingFields, "sprint">) => boolean;

function rootOf(ticket: TicketView, byId: ReadonlyMap<string, TicketView>): TicketView {
  const parentOf = (t: TicketView) => (t.parentId === null ? undefined : byId.get(t.parentId));
  const seen = new Set([ticket.id]);
  let current = ticket;
  let parent = parentOf(current);
  while (parent !== undefined && !seen.has(parent.id)) {
    seen.add(parent.id);
    current = parent;
    parent = parentOf(current);
  }
  return current;
}

export function trackingOf(
  ticket: TicketView,
  byId: ReadonlyMap<string, TicketView>,
  sprints: readonly SprintSource[],
): TrackingFields {
  const root = rootOf(ticket, byId);
  const sprint = sprints.find((s) => s.id === ticket.effectiveSprintId);
  return {
    sprint: sprint ? { id: sprint.id, code: sprint.code, name: sprint.name } : null,
    feature: isFeature(root) ? { key: root.keyLabel, shortKey: root.shortKey, title: root.title } : null,
    optional: ticket.optional,
  };
}

const currentOf = (sprints: readonly SprintSource[]): SprintSource | null =>
  sortSprints(sprints)
    .filter((s) => s.state === "current")
    .at(-1) ?? null;

export function sprintSelector(raw: string, sprints: readonly SprintSource[]): SprintSelector | null {
  const wanted = raw.trim();
  if (wanted === "none") return (t) => t.sprint === null;
  if (wanted === "current") {
    const current = currentOf(sprints);
    return (t) => current !== null && t.sprint?.id === current.id;
  }
  const target = findSprint(sprints, wanted);
  return target === null ? null : (t) => t.sprint?.id === target.id;
}
