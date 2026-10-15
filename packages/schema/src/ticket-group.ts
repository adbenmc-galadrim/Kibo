import { NOT_STARTED_STATUSES } from "./startable";
import type { StatusId } from "./status";

export type GroupProgress = { done: number; total: number };
export type GroupState = { statusId: StatusId; progress: GroupProgress };
type GroupFacts = { id: string; parentId: string | null; statusId: StatusId };

export const isGroup = (t: { progress: GroupProgress }): boolean => t.progress.total > 0;

export function groupStatus(children: readonly StatusId[]): StatusId {
  if (children.length > 0 && children.every((s) => s === "done")) return "done";
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
    const state = {
      statusId: groupStatus(statuses),
      progress: { done: statuses.filter((s) => s === "done").length, total: statuses.length },
    };
    groups.set(t.id, state);
    return state.statusId;
  };
  for (const t of tickets) statusOf(t);
  return groups;
}
