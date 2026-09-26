import { z } from "zod";

export const ProjectKey = z.string().regex(/^[A-Z]{2,6}$/);
export const TicketKey = z.string().regex(/^[A-Z]{2,6}-\d+$/);
export const NodeId = z.string().min(1);
export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const Base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
  .refine((s) => s.length % 4 === 0, "base64 length must be a multiple of 4");

export function formatTicketKey(projectKey: string, seq: number): string {
  return `${projectKey}-${seq}`;
}
