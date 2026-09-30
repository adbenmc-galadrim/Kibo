import { z } from "zod";

export const ICON_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export const IconMime = z.enum(ICON_MIMES);
export type IconMime = z.infer<typeof IconMime>;
export const MAX_ICON_BYTES = 256 * 1024;
export const MAX_ICON_BASE64 = 350_000;

export const IconInput = z.object({
  mime: IconMime,
  data: z
    .string()
    .min(1)
    .max(MAX_ICON_BASE64)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type IconInput = z.infer<typeof IconInput>;

export const IconOwner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
  z.object({ kind: z.literal("workspace") }),
]);
export type IconOwner = z.infer<typeof IconOwner>;

export const iconOwnerKey = (owner: IconOwner): string =>
  owner.kind === "workspace" ? "workspace" : `project:${owner.projectId}`;

export const iconUrl = (owner: IconOwner, version: string): string =>
  owner.kind === "workspace"
    ? `/icons/workspace?v=${version}`
    : `/icons/project/${encodeURIComponent(owner.projectId)}?v=${version}`;
