import { KiboError, type MemberInfo, MemberRole, SyncId } from "@kibo/schema";
import { z } from "zod";
import { audit } from "./audit";
import type { ServerDb } from "./db";
import { validate } from "./validate";

const NewProject = z.object({
  id: SyncId,
  ownerId: SyncId,
  name: z.string().trim().min(1).max(200),
  ticketSeq: z.number().int().nonnegative(),
});
const RoleChange = z.object({ projectId: SyncId, userId: SyncId, role: MemberRole.nullable() });

export function insertProject(
  sdb: ServerDb,
  raw: { id: string; ownerId: string; name: string; ticketSeq: number },
  now: number,
): void {
  const input = validate(NewProject, raw);
  sdb.db.transaction(() => {
    sdb.db
      .query(
        "INSERT INTO projects (id, ownerId, name, createdAt, ticketSeq) VALUES ($id, $ownerId, $name, $now, $ticketSeq)",
      )
      .run({ ...input, now });
    sdb.db
      .query("INSERT INTO members (projectId, userId, role, addedAt) VALUES ($p, $u, 'owner', $now)")
      .run({ p: input.id, u: input.ownerId, now });
  })();
}

export function roleOf(sdb: ServerDb, projectId: string, userId: string): MemberRole | null {
  const row = sdb.db
    .query<{ role: MemberRole }, { p: string; u: string }>(
      "SELECT role FROM members WHERE projectId = $p AND userId = $u",
    )
    .get({ p: projectId, u: userId });
  return row?.role ?? null;
}

export function listMembers(sdb: ServerDb, projectId: string): MemberInfo[] {
  return sdb.db
    .query<MemberInfo, { p: string }>(
      "SELECT m.userId AS userId, u.name AS name, m.role AS role FROM members m JOIN users u ON u.id = m.userId " +
        "WHERE m.projectId = $p ORDER BY m.addedAt, m.rowid",
    )
    .all({ p: projectId });
}

function ownerCount(sdb: ServerDb, projectId: string): number {
  const row = sdb.db
    .query<{ n: number }, { p: string }>(
      "SELECT COUNT(*) AS n FROM members WHERE projectId = $p AND role = 'owner'",
    )
    .get({ p: projectId });
  return row?.n ?? 0;
}

function assertTargets(sdb: ServerDb, projectId: string, userId: string): void {
  if (!sdb.db.query("SELECT 1 FROM projects WHERE id = $id").get({ id: projectId })) {
    throw new KiboError("NOT_FOUND", `project ${projectId} is not shared`);
  }
  if (!sdb.db.query("SELECT 1 FROM users WHERE id = $id").get({ id: userId })) {
    throw new KiboError("NOT_FOUND", "user not found");
  }
}

export function setRole(
  sdb: ServerDb,
  raw: { projectId: string; userId: string; role: MemberRole | null },
  now: number,
): void {
  const input = validate(RoleChange, raw);
  sdb.db.transaction(() => {
    assertTargets(sdb, input.projectId, input.userId);
    const current = roleOf(sdb, input.projectId, input.userId);
    if (current === "owner" && input.role !== "owner" && ownerCount(sdb, input.projectId) <= 1) {
      throw new KiboError("FORBIDDEN", "a shared project keeps at least one owner");
    }
    if (input.role === null) {
      if (current === null) throw new KiboError("NOT_FOUND", "user is not a member");
      sdb.db
        .query("DELETE FROM members WHERE projectId = $p AND userId = $u")
        .run({ p: input.projectId, u: input.userId });
      audit(sdb, { at: now, kind: "member-removed", userId: input.userId, projectId: input.projectId });
      return;
    }
    sdb.db
      .query(
        "INSERT INTO members (projectId, userId, role, addedAt) VALUES ($p, $u, $role, $now) " +
          "ON CONFLICT(projectId, userId) DO UPDATE SET role = excluded.role",
      )
      .run({ p: input.projectId, u: input.userId, role: input.role, now });
    audit(sdb, {
      at: now,
      kind: "role-changed",
      userId: input.userId,
      projectId: input.projectId,
      detail: input.role,
    });
  })();
}

export function projectsOf(sdb: ServerDb, userId: string): { id: string; name: string; role: MemberRole }[] {
  return sdb.db
    .query<{ id: string; name: string; role: MemberRole }, { u: string }>(
      "SELECT p.id AS id, p.name AS name, m.role AS role FROM members m JOIN projects p ON p.id = m.projectId " +
        "WHERE m.userId = $u ORDER BY p.createdAt, p.rowid",
    )
    .all({ u: userId });
}
