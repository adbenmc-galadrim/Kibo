import { z } from "zod";
import { KiboError } from "./errors";
import { Base64 } from "./ids";
import { MemberInfo, MemberRole } from "./sharing";

export const PresenceRun = z.object({
  ticketKey: z.string().nullable(),
  profile: z.string(),
  state: z.string(),
});
export type PresenceRun = z.infer<typeof PresenceRun>;
export const PresenceState = z.object({
  userId: z.string(),
  name: z.string(),
  pageId: z.string().nullable(),
  ticketId: z.string().nullable(),
  runs: z.array(PresenceRun).max(50),
});
export type PresenceState = z.infer<typeof PresenceState>;
export const DeviceInfo = z.object({
  deviceId: z.string(),
  name: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number().nullable(),
  revokedAt: z.number().nullable(),
});
export type DeviceInfo = z.infer<typeof DeviceInfo>;
export const RejectCode = z.enum([
  "UPDATE_REJECTED",
  "OUT_OF_DATE",
  "FORBIDDEN",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
]);
export type RejectCode = z.infer<typeof RejectCode>;

export const SyncId = z.string().min(1).max(128);
const projectId = SyncId;
const requestId = z.string().min(1).max(64);
const seq = z.number().int().nonnegative();

export const ClientFrame = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auth"), deviceId: SyncId, signature: Base64 }),
  z.object({ type: z.literal("subscribe"), projectId, version: Base64.nullable() }),
  z.object({ type: z.literal("unsubscribe"), projectId }),
  z.object({ type: z.literal("push"), projectId, bytes: Base64, clientBatchId: requestId }),
  z.object({ type: z.literal("presence"), projectId, bytes: Base64 }),
  z.object({
    type: z.literal("share"),
    projectId,
    requestId,
    name: z.string().trim().min(1).max(200),
    snapshot: Base64,
  }),
  z.object({ type: z.literal("invite"), projectId, requestId, role: z.enum(["editor", "viewer"]) }),
  z.object({ type: z.literal("redeem"), requestId, code: z.string().min(1).max(64) }),
  z.object({
    type: z.literal("set-role"),
    projectId,
    requestId,
    userId: SyncId,
    role: MemberRole.nullable(),
  }),
  z.object({ type: z.literal("unshare"), projectId, requestId }),
  z.object({ type: z.literal("device-invite"), requestId }),
  z.object({ type: z.literal("list-devices"), requestId }),
  z.object({ type: z.literal("revoke-device"), requestId, deviceId: SyncId }),
]);
export type ClientFrame = z.infer<typeof ClientFrame>;

export const ServerFrame = z.discriminatedUnion("type", [
  z.object({ type: z.literal("challenge"), nonce: Base64 }),
  z.object({
    type: z.literal("welcome"),
    userId: z.string(),
    name: z.string(),
    deviceId: z.string(),
    projects: z.array(z.object({ id: projectId, name: z.string(), role: MemberRole })),
  }),
  z.object({ type: z.literal("update"), projectId, bytes: Base64, serverSeq: seq, version: Base64 }),
  z.object({ type: z.literal("ack"), projectId, clientBatchId: requestId, serverSeq: seq, version: Base64 }),
  z.object({
    type: z.literal("reject"),
    projectId,
    clientBatchId: requestId,
    code: RejectCode,
    message: z.string(),
    version: Base64.nullable(),
  }),
  z.object({ type: z.literal("presence"), projectId, bytes: Base64 }),
  z.object({ type: z.literal("members"), projectId, members: z.array(MemberInfo) }),
  z.object({ type: z.literal("invite-code"), requestId, code: z.string(), expiresAt: z.number() }),
  z.object({ type: z.literal("shared"), requestId, projectId }),
  z.object({ type: z.literal("joined"), requestId, projectId, name: z.string(), role: MemberRole }),
  z.object({ type: z.literal("revoked"), projectId, reason: z.enum(["removed", "deleted"]) }),
  z.object({ type: z.literal("devices"), requestId, devices: z.array(DeviceInfo) }),
  z.object({ type: z.literal("done"), requestId }),
  z.object({
    type: z.literal("error"),
    requestId: requestId.nullable(),
    code: z.string(),
    message: z.string(),
  }),
]);
export type ServerFrame = z.infer<typeof ServerFrame>;

export const JoinRequest = z.object({
  code: z.string().min(1).max(64),
  publicKey: Base64,
  deviceName: z.string().trim().min(1).max(64),
});
export type JoinRequest = z.infer<typeof JoinRequest>;
export const JoinResponse = z.object({ userId: z.string(), deviceId: z.string(), name: z.string() });
export type JoinResponse = z.infer<typeof JoinResponse>;

export const MAX_FRAME_BYTES = 8 * 1024 * 1024;
export const CHALLENGE_PREFIX = "kibo-sync-v1";

export function challengePayload(nonce: string, origin: string): Uint8Array {
  return new TextEncoder().encode(`${CHALLENGE_PREFIX}\n${nonce}\n${origin}`);
}

function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (isSurrogatePair(text, i)) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function isSurrogatePair(text: string, i: number): boolean {
  const high = text.charCodeAt(i);
  const low = text.charCodeAt(i + 1);
  return high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;
}

function parseWith<T>(schema: z.ZodType<T>, raw: string): T {
  if (raw.length > MAX_FRAME_BYTES || utf8ByteLength(raw) > MAX_FRAME_BYTES)
    throw new KiboError("INVALID_INPUT", "frame too large");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `frame is not JSON: ${String(e)}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid frame: ${parsed.error.message}`);
  return parsed.data;
}

export const parseClientFrame = (raw: string): ClientFrame => parseWith(ClientFrame, raw);
export const parseServerFrame = (raw: string): ServerFrame => parseWith(ServerFrame, raw);
export const encodeFrame = (frame: ClientFrame | ServerFrame): string => JSON.stringify(frame);

export const SYNC_LIMITS = {
  batchMs: 50,
  projectBytes: 50 * 1024 * 1024,
  updatesPerSecond: 100,
  connectionsPerUser: 20,
  authFailuresPerMinute: 5,
  authBlockMs: 5 * 60_000,
  compactEvery: 500,
  unloadAfterMs: 10 * 60_000,
  backoffMinMs: 1000,
  backoffMaxMs: 60_000,
  presenceTimeoutMs: 30_000,
  presenceRefreshMs: 10_000,
  accountInviteMs: 48 * 3_600_000,
  deviceInviteMs: 15 * 60_000,
  projectInviteMs: 48 * 3_600_000,
} as const;

export const CLOSE_CODES = {
  authFailed: 4401,
  deviceRevoked: 4403,
  accessRevoked: 4404,
  tooManyConnections: 4429,
} as const;

export type SyncConnectionState = "unconfigured" | "connecting" | "online" | "offline";
export type SyncProjectStatus = {
  projectId: string;
  name: string;
  role: MemberRole;
  lastSyncAt: number | null;
  lastError: string | null;
  accessRevoked: boolean;
};
export type SyncStatus = {
  state: SyncConnectionState;
  serverUrl: string | null;
  user: { id: string; name: string } | null;
  deviceId: string | null;
  retryAt: number | null;
  lastError: string | null;
  projects: SyncProjectStatus[];
};
export type PresencePeer = PresenceState & { deviceId: string; self: boolean };

export const Phase7Event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("collab.changed") }),
  z.object({ type: z.literal("presence.changed"), projectId }),
  z.object({ type: z.literal("market.changed") }),
  z.object({ type: z.literal("sessions.changed") }),
  z.object({ type: z.literal("sandbox.changed") }),
]);
export type Phase7Event = z.infer<typeof Phase7Event>;
