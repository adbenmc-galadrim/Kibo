import type { ProjectMeta, ProjectSnapshot, StatusId, TicketView } from "@kibo/schema";

export type MineTab = "assigned" | "agents" | "created";
export type MineGroup = { project: ProjectMeta; tickets: TicketView[] };

export const MINE_STATUS_ORDER: readonly StatusId[] = [
  "blocked",
  "in_progress",
  "todo",
  "in_review",
  "backlog",
];

const rank = (s: StatusId) => MINE_STATUS_ORDER.indexOf(s);
const keyNumber = (key: string) => Number(key.slice(key.lastIndexOf("-") + 1));
const waits = (t: TicketView) => (t.waitingOn.length > 0 ? 0 : 1);

export function isMine(t: TicketView, viewer: string, tab: MineTab): boolean {
  if (t.statusId === "done") return false;
  if (tab === "assigned") return t.assignee?.kind === "human" && t.assignee.ref === viewer;
  if (tab === "agents") return t.assignee?.kind === "agent";
  return false;
}

export function compareMine(a: TicketView, b: TicketView): number {
  return rank(a.statusId) - rank(b.statusId) || waits(a) - waits(b) || keyNumber(a.key) - keyNumber(b.key);
}

export function myTickets(
  projects: readonly ProjectMeta[],
  snapshots: ReadonlyMap<string, ProjectSnapshot>,
  viewer: string,
  tab: MineTab,
): MineGroup[] {
  return projects.flatMap((project) => {
    const tickets = (snapshots.get(project.id)?.tickets ?? [])
      .filter((t) => isMine(t, viewer, tab))
      .sort(compareMine);
    return tickets.length > 0 ? [{ project, tickets }] : [];
  });
}

export const countMine = (groups: readonly MineGroup[]): number =>
  groups.reduce((n, g) => n + g.tickets.length, 0);
