import { NOT_STARTED_STATUSES } from "./startable";
import type { StatusId } from "./status";

type GroupProgress = { done: number; total: number };
type GroupState = { statusId: StatusId; progress: GroupProgress };
type GroupFacts = { id: string; parentId: string | null; statusId: StatusId; optional?: boolean };

export const isGroup = (t: { progress: GroupProgress }): boolean => t.progress.total > 0;

export function groupStatus(
  children: readonly StatusId[],
  mandatory: readonly StatusId[] = children,
): StatusId {
  if (children.length > 0 && mandatory.every((s) => s === "done")) return "done";
  return children.some((s) => !NOT_STARTED_STATUSES.includes(s)) ? "in_progress" : "todo";
}

export function deriveGroups(tickets: readonly GroupFacts[]): Map<string, GroupState> {
  const children = new Map<string, GroupFacts[]>();
  for (const t of tickets) {
    if (t.parentId !== null) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t]);
  }
  const groups = new Map<string, GroupState>();
  const statusOf = (t: GroupFacts): StatusId => {
    const kids = children.get(t.id);
    if (kids === undefined) return t.statusId;
    const known = groups.get(t.id);
    if (known) return known.statusId;
    const statuses = kids.map(statusOf);
    const mandatory = kids.filter((k) => k.optional !== true).map(statusOf);
    const state = {
      statusId: groupStatus(statuses, mandatory),
      progress: { done: statuses.filter((s) => s === "done").length, total: statuses.length },
    };
    groups.set(t.id, state);
    return state.statusId;
  };
  for (const t of tickets) statusOf(t);
  return groups;
}
