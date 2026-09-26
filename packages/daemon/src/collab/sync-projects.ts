import { getProjectMeta } from "@kibo/core";
import {
  type ChangeMessage,
  KiboError,
  type KiboErrorCode,
  type MemberInfo,
  type MemberRole,
  type SyncProjectStatus,
} from "@kibo/schema";
import { accessOf } from "./project-info";
import type { SyncDb, SyncProjectRow } from "./sync-db";
import type { ProjectHostRegistry } from "./types";

export type RevokeReason = "removed" | "deleted" | "disconnected";
const REVOKED_CODE = {
  removed: "ACCESS_REVOKED",
  deleted: "NOT_FOUND",
  disconnected: "NOT_CONNECTED",
} as const satisfies Record<RevokeReason, KiboErrorCode>;

type Deps = {
  db: SyncDb;
  hosts: ProjectHostRegistry;
  now(): number;
  emit(message: ChangeMessage): void;
};

export class SyncProjects {
  private readonly members = new Map<string, MemberInfo[]>();

  constructor(private readonly deps: Deps) {}

  rows(): SyncProjectRow[] {
    return this.deps.db.projects();
  }

  row(projectId: string): SyncProjectRow | null {
    return this.deps.db.project(projectId);
  }

  membersOf(projectId: string): MemberInfo[] {
    return this.members.get(projectId) ?? [];
  }

  statuses(): SyncProjectStatus[] {
    return this.rows().map((r) => ({
      projectId: r.projectId,
      name: this.projectName(r.projectId),
      role: r.role,
      lastSyncAt: r.lastSyncAt,
      lastError: r.lastError,
      accessRevoked: r.accessRevoked,
    }));
  }

  applyAllAccess(): void {
    for (const row of this.rows()) this.applyAccess(row);
  }

  attach(projectId: string, role: MemberRole): void {
    const row = this.row(projectId);
    const next: SyncProjectRow = {
      projectId,
      enabled: true,
      role,
      lastServerVersion: row?.lastServerVersion ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: null,
      accessRevoked: false,
    };
    this.save(next);
  }

  detach(projectId: string): void {
    this.deps.db.removeProject(projectId);
    this.members.delete(projectId);
    if (this.exists(projectId)) this.deps.hosts.setAccess(projectId, "write");
    this.changed();
  }

  setRole(projectId: string, role: MemberRole): void {
    const row = this.row(projectId);
    if (row && row.role !== role) this.save({ ...row, role });
  }

  saveServerVersion(projectId: string, version: Uint8Array | null): void {
    const row = this.row(projectId);
    if (row) this.deps.db.upsertProject({ ...row, lastServerVersion: version });
  }

  synced(projectId: string, clearError: boolean): void {
    const row = this.row(projectId);
    if (!row) return;
    this.save({ ...row, lastSyncAt: this.deps.now(), lastError: clearError ? null : row.lastError });
  }

  failed(projectId: string, code: string): void {
    const row = this.row(projectId);
    if (row) this.save({ ...row, lastError: code });
  }

  setMembers(projectId: string, members: MemberInfo[], selfId: string | null): void {
    this.members.set(projectId, members);
    const me = members.find((m) => m.userId === selfId);
    if (me) this.setRole(projectId, me.role);
    if (this.row(projectId) && this.exists(projectId)) this.deps.emit({ projectId });
  }

  revoke(projectId: string, reason: RevokeReason): void {
    const row = this.row(projectId);
    if (!row) return;
    this.save({ ...row, enabled: false, accessRevoked: true, lastError: REVOKED_CODE[reason] });
  }

  private save(row: SyncProjectRow): void {
    this.deps.db.upsertProject(row);
    this.applyAccess(row);
    this.changed();
  }

  private applyAccess(row: SyncProjectRow): void {
    if (this.exists(row.projectId)) this.deps.hosts.setAccess(row.projectId, accessOf(row));
  }

  private exists(projectId: string): boolean {
    return this.deps.hosts.projectIds().includes(projectId);
  }

  private changed(): void {
    this.deps.emit({ type: "collab.changed" });
  }

  private projectName(projectId: string): string {
    try {
      return getProjectMeta(this.deps.hosts.host(projectId).doc()).name;
    } catch (e) {
      if (e instanceof KiboError && e.code === "NOT_FOUND") return projectId;
      throw e;
    }
  }
}
