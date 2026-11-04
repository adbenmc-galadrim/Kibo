import type { PaletteRoles } from "@kibo/schema";

export type Roles = PaletteRoles;
export type Role = keyof Roles;

export const ROLE_GROUPS = [
  { id: "surfaces", roles: ["bg", "panel", "card", "muted", "hover", "border"] },
  { id: "text", roles: ["fg", "mfg", "dim"] },
  { id: "status", roles: ["blue", "purple", "red", "green", "amber", "hold"] },
  { id: "brand", roles: ["accent", "agent"] },
] as const satisfies readonly { id: string; roles: readonly Role[] }[];

export type Scheme = "dark" | "light";
