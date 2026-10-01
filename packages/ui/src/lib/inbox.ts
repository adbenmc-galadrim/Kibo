import {
  INBOX_ID,
  INBOX_KEY,
  isInbox,
  type ProjectMeta,
  type ProjectSnapshot,
  type ProjectSummary,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { fr } from "../i18n/fr";
import { canEdit } from "../state/access";

const INBOX_COLOR = "#64748B";

export function inboxMeta(): ProjectMeta {
  return { id: INBOX_ID, key: INBOX_KEY, name: fr.nav.inbox, folder: null, color: INBOX_COLOR };
}

export const displayName = (meta: Pick<ProjectMeta, "id" | "name">): string =>
  isInbox(meta.id) ? fr.nav.inbox : meta.name;

export function inboxSummary(snapshot: ProjectSnapshot): ProjectSummary {
  const counts: Record<StatusId, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    blocked: 0,
    done: 0,
  };
  for (const t of snapshot.tickets) counts[t.statusId] += 1;
  return { ...inboxMeta(), counts };
}

export function withInbox<T extends ProjectMeta>(
  projects: readonly T[],
  snapshots: ReadonlyMap<string, ProjectSnapshot>,
): (T | ProjectSummary)[] {
  const inbox = snapshots.get(INBOX_ID);
  return inbox ? [inboxSummary(inbox), ...projects] : [...projects];
}

export const openInboxCount = (snapshot: ProjectSnapshot | undefined): number =>
  snapshot ? snapshot.tickets.filter((t) => t.statusId !== "done").length : 0;

export function newTicketProjects(
  projects: readonly ProjectMeta[],
  snapshots: ReadonlyMap<string, ProjectSnapshot>,
): ProjectMeta[] {
  const writable = projects.filter((p) => {
    const snapshot = snapshots.get(p.id);
    return !isInbox(p.id) && snapshot !== undefined && canEdit(snapshot);
  });
  return [inboxMeta(), ...writable];
}

export function subtreeIds(tickets: readonly TicketView[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  for (const id of ids) for (const t of tickets) if (t.parentId === id) ids.add(t.id);
  return ids;
}

export function fileScope(
  inbox: ProjectSnapshot,
  ticketId: string,
): { hasChildren: boolean; hasLinks: boolean } {
  const ids = subtreeIds(inbox.tickets, ticketId);
  return {
    hasChildren: ids.size > 1,
    hasLinks: inbox.links.some((l) => ids.has(l.from) !== ids.has(l.to)),
  };
}
