import { z } from "zod";

export type SessionInfo = {
  id: string;
  deviceName: string;
  remote: boolean;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  current: boolean;
};

export const SESSION_RPC = [
  z.object({ method: z.literal("listSessions") }),
  z.object({ method: z.literal("revokeSession"), id: z.string().regex(/^[0-9a-f]{64}$/) }),
] as const;

export type SessionRpcResult = {
  listSessions: SessionInfo[];
  revokeSession: null;
};
