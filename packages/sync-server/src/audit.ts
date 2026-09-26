import type { ServerDb } from "./db";

export type AuditKind =
  | "connect"
  | "auth-failed"
  | "invite-created"
  | "invite-redeemed"
  | "role-changed"
  | "member-removed"
  | "device-revoked"
  | "user-disabled"
  | "update-rejected"
  | "project-shared"
  | "project-deleted"
  | "market-published"
  | "market-revoked";

export type AuditEntry = {
  id: number;
  at: number;
  kind: AuditKind;
  userId: string | null;
  deviceId: string | null;
  projectId: string | null;
  detail: string | null;
};

export type AuditInput = {
  at: number;
  kind: AuditKind;
  userId?: string | null;
  deviceId?: string | null;
  projectId?: string | null;
  detail?: string;
};

export function audit(sdb: ServerDb, e: AuditInput): void {
  sdb.db
    .query(
      "INSERT INTO audit (at, kind, userId, deviceId, projectId, detail) VALUES ($at, $kind, $userId, $deviceId, $projectId, $detail)",
    )
    .run({
      at: e.at,
      kind: e.kind,
      userId: e.userId ?? null,
      deviceId: e.deviceId ?? null,
      projectId: e.projectId ?? null,
      detail: e.detail ?? null,
    });
}

export function readAudit(sdb: ServerDb, limit: number): AuditEntry[] {
  return sdb.db
    .query<AuditEntry, { limit: number }>("SELECT * FROM audit ORDER BY id DESC LIMIT $limit")
    .all({ limit });
}
