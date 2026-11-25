import { KIBO_ERROR_CODES } from "@kibo/schema";
import { z } from "zod";
import { SnapshotKind } from "./snapshot-kinds";

export const SNAPSHOT_MAX_BYTES = 8 * 1_048_576;
export const REQUEST_TIMEOUT_MS = 30_000;
export const PAIR_TOKEN_TTL_MS = 600_000;
export const PAIR_TOKEN_ATTEMPTS = 5;
export const REQUEST_CLOCK_REFUSAL = "request time is outside the replay window";

const BASE64URL = /^[A-Za-z0-9_-]*$/;
const NONCE_BASE64URL_LENGTH = 16;

const Base64Url = z.string().regex(BASE64URL, "base64url without padding");
const Nonce = Base64Url.length(NONCE_BASE64URL_LENGTH);
const ProjectId = z.string().min(1);
const Epoch = z.number().int().positive();

export const SnapshotHeader = z.object({
  v: z.literal(1),
  projectId: ProjectId,
  kind: SnapshotKind,
  seq: z.number().int().nonnegative(),
  builtAt: z.number().int(),
  keyEpoch: Epoch,
});
export type SnapshotHeader = z.infer<typeof SnapshotHeader>;

export const Sealed = z.object({ header: SnapshotHeader, nonce: Nonce, ciphertext: Base64Url });
export type Sealed = z.infer<typeof Sealed>;

export const RequestHeader = z.object({
  v: z.literal(1),
  requestId: z.string().uuid(),
  projectId: ProjectId.nullable(),
  at: z.number().int(),
  keyEpoch: Epoch,
});
export type RequestHeader = z.infer<typeof RequestHeader>;

export const SealedRequest = z.object({ header: RequestHeader, nonce: Nonce, ciphertext: Base64Url });
export type SealedRequest = z.infer<typeof SealedRequest>;

export const MacMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot.put"), sealed: Sealed }),
  z.object({ type: z.literal("snapshot.remove"), projectId: ProjectId, kind: SnapshotKind }),
  z.object({ type: z.literal("project.remove"), projectId: ProjectId }),
  z.object({ type: z.literal("pair.create") }),
  z.object({ type: z.literal("phone.revoke") }),
  z.object({ type: z.literal("request.reply"), requestId: z.string().uuid(), sealed: SealedRequest }),
  z.object({ type: z.literal("ping"), at: z.number().int() }),
]);
export type MacMessage = z.infer<typeof MacMessage>;

export const ServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("request"), requestId: z.string().uuid(), sealed: SealedRequest }),
  z.object({ type: z.literal("pair.created"), pairToken: Base64Url.min(1), expiresAt: z.number().int() }),
  z.object({ type: z.literal("pong"), at: z.number().int() }),
  z.object({ type: z.literal("error"), code: z.enum(KIBO_ERROR_CODES), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export const PhoneEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot.changed"),
    projectId: ProjectId,
    kind: SnapshotKind,
    seq: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("snapshot.removed"), projectId: ProjectId, kind: SnapshotKind }),
  z.object({ type: z.literal("mac.presence"), online: z.boolean(), lastSeenAt: z.number().int().nullable() }),
]);
export type PhoneEvent = z.infer<typeof PhoneEvent>;
