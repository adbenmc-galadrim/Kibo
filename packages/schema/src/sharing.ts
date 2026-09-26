import { z } from "zod";

export const MemberRole = z.enum(["owner", "editor", "viewer"]);
export type MemberRole = z.infer<typeof MemberRole>;
export const KeyAllocator = z.enum(["local", "server"]);
export type KeyAllocator = z.infer<typeof KeyAllocator>;
export const MemberInfo = z.object({ userId: z.string().min(1), name: z.string().min(1), role: MemberRole });
export type MemberInfo = z.infer<typeof MemberInfo>;
export type ProjectAccess = "write" | "read-only" | "revoked";
export type ProjectSyncInfo = {
  shared: boolean;
  keyAllocator: KeyAllocator;
  role: MemberRole | null;
  access: ProjectAccess;
  members: MemberInfo[];
};
