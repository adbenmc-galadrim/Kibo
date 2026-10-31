import { z } from "zod";

export const SESSION_REVOKED_CLOSE = 4401;

export const Phase7Event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sessions.changed") }),
  z.object({ type: z.literal("backups.changed") }),
]);
export type Phase7Event = z.infer<typeof Phase7Event>;
