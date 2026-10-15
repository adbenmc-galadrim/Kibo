import { KiboError, type ProjectSnapshot, parentTicketDetail, type RunView } from "@kibo/schema";
import type { AgentDataPort } from "./orchestrator-types";

export function assertLeaf(childCount: number): void {
  if (childCount > 0) throw new KiboError("TICKET_HAS_CHILDREN", parentTicketDetail(childCount));
}

export type ChildrenProbe = (run: Pick<RunView, "projectId" | "ticketId">) => number;

export function childrenProbe(data: Pick<AgentDataPort, "ticketContext">): ChildrenProbe {
  const projects = new Map<string, ProjectSnapshot>();
  const projectOf = (projectId: string, ticketId: string): ProjectSnapshot => {
    const known = projects.get(projectId);
    if (known) return known;
    const { project } = data.ticketContext(projectId, ticketId);
    projects.set(projectId, project);
    return project;
  };
  return ({ projectId, ticketId }) => {
    if (projectId === null || ticketId === null) return 0;
    try {
      return projectOf(projectId, ticketId).tickets.filter((t) => t.parentId === ticketId).length;
    } catch (e) {
      if (e instanceof KiboError && e.code === "NOT_FOUND") return 0;
      throw e;
    }
  };
}
