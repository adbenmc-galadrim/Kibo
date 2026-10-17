import { isFeature, type ProjectSnapshot, splitRef, type TabTarget } from "@kibo/schema";

export const PLANNING_ID = "planning";

type Planned = Pick<ProjectSnapshot, "instances">;

export const planningPageOf = (project: Planned): string | null =>
  project.instances.find((i) => splitRef(i.component).id === PLANNING_ID)?.pageId ?? null;

export const planningMissing = (project: Planned): boolean => planningPageOf(project) === null;

export function featureOf(project: Pick<ProjectSnapshot, "tickets">, ticketId: string) {
  const ticket = project.tickets.find((t) => t.id === ticketId);
  return ticket && isFeature(ticket) ? ticket : null;
}

export function activePageOf(
  project: Pick<ProjectSnapshot, "meta" | "instances" | "tickets">,
  target: TabTarget | null,
): string | null {
  if (target?.kind === "page") return target.projectId === project.meta.id ? target.pageId : null;
  if (target?.kind !== "ticket" || target.projectId !== project.meta.id) return null;
  return featureOf(project, target.ticketId) ? planningPageOf(project) : null;
}
