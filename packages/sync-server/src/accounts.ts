import {
  type DeviceInfo,
  JoinRequest,
  type JoinResponse,
  KiboError,
  type MemberRole,
  SYNC_LIMITS,
  SyncId,
} from "@kibo/schema";
import { hashCode, newInviteCode, parsePublicKey } from "@kibo/trust";
import { z } from "zod";
import { audit } from "./audit";
import type { ServerDb } from "./db";
import { validate } from "./validate";

export const InviteInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("account"), name: z.string().trim().min(1).max(64), createdBy: SyncId }),
  z.object({ kind: z.literal("device"), userId: SyncId, createdBy: SyncId }),
  z.object({
    kind: z.literal("project"),
    projectId: SyncId,
    role: z.enum(["editor", "viewer"]),
    createdBy: SyncId,
  }),
]);
export type InviteInput = z.infer<typeof InviteInput>;

const ProjectRedeem = z.object({ code: JoinRequest.shape.code, userId: SyncId });

type InviteKind = InviteInput["kind"];
type InviteRow = {
  kind: InviteKind;
  name: string | null;
  userId: string | null;
  projectId: string | null;
  role: "editor" | "viewer" | null;
  expiresAt: number;
  usedAt: number | null;
};

const TTL: Record<InviteKind, number> = {
  account: SYNC_LIMITS.accountInviteMs,
  device: SYNC_LIMITS.deviceInviteMs,
  project: SYNC_LIMITS.projectInviteMs,
};

const invalidInvite = () =>
  new KiboError("INVITE_INVALID", "invite code is invalid, expired or already used");

function activeUserName(sdb: ServerDb, userId: string): string | null {
  const row = sdb.db
    .query<{ name: string; disabledAt: number | null }, { id: string }>(
      "SELECT name, disabledAt FROM users WHERE id = $id",
    )
    .get({ id: userId });
  return row && row.disabledAt === null ? row.name : null;
}

function projectExists(sdb: ServerDb, projectId: string): boolean {
  return sdb.db.query("SELECT 1 FROM projects WHERE id = $id").get({ id: projectId }) !== null;
}

export async function createInvite(
  sdb: ServerDb,
  raw: InviteInput,
  now: number,
): Promise<{ code: string; expiresAt: number }> {
  const input = validate(InviteInput, raw);
  if (input.kind === "device" && activeUserName(sdb, input.userId) === null) {
    throw new KiboError("FORBIDDEN", "user is unknown or disabled");
  }
  if (input.kind === "project" && !projectExists(sdb, input.projectId)) {
    throw new KiboError("NOT_FOUND", `project ${input.projectId} is not shared`);
  }
  const code = newInviteCode();
  const codeHash = await hashCode(code);
  const expiresAt = now + TTL[input.kind];
  sdb.db.transaction(() => {
    sdb.db
      .query(
        "INSERT INTO invites (codeHash, kind, name, userId, projectId, role, createdBy, createdAt, expiresAt, usedAt) " +
          "VALUES ($codeHash, $kind, $name, $userId, $projectId, $role, $createdBy, $createdAt, $expiresAt, NULL)",
      )
      .run({
        codeHash,
        kind: input.kind,
        name: input.kind === "account" ? input.name : null,
        userId: input.kind === "device" ? input.userId : null,
        projectId: input.kind === "project" ? input.projectId : null,
        role: input.kind === "project" ? input.role : null,
        createdBy: input.createdBy,
        createdAt: now,
        expiresAt,
      });
    audit(sdb, {
      at: now,
      kind: "invite-created",
      userId: input.createdBy,
      projectId: input.kind === "project" ? input.projectId : null,
      detail: input.kind,
    });
  })();
  return { code, expiresAt };
}

function takeInvite(sdb: ServerDb, codeHash: string, kinds: InviteKind[], now: number): InviteRow {
  const row = sdb.db
    .query<InviteRow, { codeHash: string }>(
      "SELECT kind, name, userId, projectId, role, expiresAt, usedAt FROM invites WHERE codeHash = $codeHash",
    )
    .get({ codeHash });
  if (!row || row.usedAt !== null || row.expiresAt < now || !kinds.includes(row.kind)) throw invalidInvite();
  const res = sdb.db
    .query("UPDATE invites SET usedAt = $now WHERE codeHash = $codeHash AND usedAt IS NULL")
    .run({ now, codeHash });
  if (res.changes !== 1) throw invalidInvite();
  return row;
}

function accountOf(sdb: ServerDb, invite: InviteRow, now: number): { userId: string; name: string } {
  if (invite.kind === "account" && invite.name !== null) {
    const userId = crypto.randomUUID();
    sdb.db
      .query("INSERT INTO users (id, name, createdAt, disabledAt) VALUES ($id, $name, $now, NULL)")
      .run({ id: userId, name: invite.name, now });
    return { userId, name: invite.name };
  }
  const name = invite.userId === null ? null : activeUserName(sdb, invite.userId);
  if (invite.userId === null || name === null) throw invalidInvite();
  return { userId: invite.userId, name };
}

export async function redeemDeviceInvite(
  sdb: ServerDb,
  req: JoinRequest,
  now: number,
): Promise<JoinResponse> {
  const input = validate(JoinRequest, req);
  parsePublicKey(input.publicKey);
  const codeHash = await hashCode(input.code);
  return sdb.db.transaction(() => {
    const invite = takeInvite(sdb, codeHash, ["account", "device"], now);
    const { userId, name } = accountOf(sdb, invite, now);
    if (sdb.db.query("SELECT 1 FROM devices WHERE publicKey = $k").get({ k: input.publicKey })) {
      throw new KiboError("INVALID_INPUT", "this public key is already registered");
    }
    const deviceId = crypto.randomUUID();
    sdb.db
      .query(
        "INSERT INTO devices (id, userId, publicKey, name, createdAt, lastSeenAt, revokedAt) " +
          "VALUES ($id, $userId, $publicKey, $name, $now, NULL, NULL)",
      )
      .run({ id: deviceId, userId, publicKey: input.publicKey, name: input.deviceName, now });
    audit(sdb, { at: now, kind: "invite-redeemed", userId, deviceId, detail: invite.kind });
    return { userId, deviceId, name };
  })();
}

export async function redeemProjectInvite(
  sdb: ServerDb,
  raw: { code: string; userId: string },
  now: number,
): Promise<{ projectId: string; role: MemberRole }> {
  const input = validate(ProjectRedeem, raw);
  const codeHash = await hashCode(input.code);
  return sdb.db.transaction(() => {
    const invite = takeInvite(sdb, codeHash, ["project"], now);
    const { projectId, role } = invite;
    if (projectId === null || role === null || !projectExists(sdb, projectId)) throw invalidInvite();
    if (activeUserName(sdb, input.userId) === null) throw invalidInvite();
    if (
      sdb.db
        .query("SELECT 1 FROM members WHERE projectId = $p AND userId = $u")
        .get({ p: projectId, u: input.userId })
    ) {
      throw new KiboError("INVALID_INPUT", "already a member of this project");
    }
    sdb.db
      .query("INSERT INTO members (projectId, userId, role, addedAt) VALUES ($p, $u, $role, $now)")
      .run({ p: projectId, u: input.userId, role, now });
    audit(sdb, { at: now, kind: "invite-redeemed", userId: input.userId, projectId, detail: role });
    return { projectId, role };
  })();
}

export type DeviceRecord = {
  userId: string;
  name: string;
  deviceName: string;
  publicKey: string;
  revoked: boolean;
  userDisabled: boolean;
};

export function deviceRecord(sdb: ServerDb, deviceId: string): DeviceRecord | null {
  const row = sdb.db
    .query<
      Omit<DeviceRecord, "revoked" | "userDisabled"> & {
        revokedAt: number | null;
        disabledAt: number | null;
      },
      { id: string }
    >(
      "SELECT d.userId AS userId, u.name AS name, d.name AS deviceName, d.publicKey AS publicKey, " +
        "d.revokedAt AS revokedAt, u.disabledAt AS disabledAt FROM devices d JOIN users u ON u.id = d.userId WHERE d.id = $id",
    )
    .get({ id: deviceId });
  if (!row) return null;
  return {
    userId: row.userId,
    name: row.name,
    deviceName: row.deviceName,
    publicKey: row.publicKey,
    revoked: row.revokedAt !== null,
    userDisabled: row.disabledAt !== null,
  };
}

export function touchDevice(sdb: ServerDb, deviceId: string, now: number): void {
  sdb.db.query("UPDATE devices SET lastSeenAt = $now WHERE id = $id").run({ now, id: deviceId });
}

export function listDevices(sdb: ServerDb, userId: string): DeviceInfo[] {
  return sdb.db
    .query<DeviceInfo, { userId: string }>(
      "SELECT id AS deviceId, name, createdAt, lastSeenAt, revokedAt FROM devices WHERE userId = $userId ORDER BY createdAt, rowid",
    )
    .all({ userId });
}

export function revokeDevice(sdb: ServerDb, input: { deviceId: string; by: string }, now: number): void {
  if (!deviceRecord(sdb, input.deviceId)) throw new KiboError("NOT_FOUND", "device not found");
  sdb.db.transaction(() => {
    sdb.db
      .query("UPDATE devices SET revokedAt = $now WHERE id = $id AND revokedAt IS NULL")
      .run({ now, id: input.deviceId });
    audit(sdb, { at: now, kind: "device-revoked", userId: input.by, deviceId: input.deviceId });
  })();
}

export function disableUser(sdb: ServerDb, userId: string, now: number): void {
  if (!sdb.db.query("SELECT 1 FROM users WHERE id = $id").get({ id: userId })) {
    throw new KiboError("NOT_FOUND", "user not found");
  }
  sdb.db.transaction(() => {
    sdb.db
      .query("UPDATE users SET disabledAt = $now WHERE id = $id AND disabledAt IS NULL")
      .run({ now, id: userId });
    audit(sdb, { at: now, kind: "user-disabled", userId });
  })();
}
