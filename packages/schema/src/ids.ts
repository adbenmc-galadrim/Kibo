import { z } from "zod";

export const ProjectKey = z.string().regex(/^[A-Z]{2,6}$/);
export const TicketKey = z.string().regex(/^[A-Z]{2,6}-\d+$/);
export const NodeId = z.string().min(1);

export function formatTicketKey(projectKey: string, seq: number): string {
  return `${projectKey}-${seq}`;
}
