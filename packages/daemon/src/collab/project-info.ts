import { getKeyAllocator, readMembers } from "@kibo/core";
import type { MemberInfo, ProjectAccess, ProjectSyncInfo } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { SyncProjectRow } from "./sync-db";

export function accessOf(row: SyncProjectRow): ProjectAccess {
  if (row.accessRevoked) return "revoked";
  return row.role === "viewer" ? "read-only" : "write";
}

export function projectSyncInfo(input: {
  row: SyncProjectRow | null;
  doc: LoroDoc;
  members: MemberInfo[];
}): ProjectSyncInfo {
  const { row, doc } = input;
  const keyAllocator = getKeyAllocator(doc);
  if (!row) return { shared: false, keyAllocator, role: null, access: "write", members: [] };
  const directory = readMembers(doc);
  const names = new Map(directory.map((m) => [m.userId, m.name]));
  const members =
    input.members.length > 0
      ? input.members.map((m) => ({ ...m, name: names.get(m.userId) ?? m.name }))
      : directory.map((m) => ({ ...m, role: "editor" as const }));
  return { shared: true, keyAllocator, role: row.role, access: accessOf(row), members };
}
