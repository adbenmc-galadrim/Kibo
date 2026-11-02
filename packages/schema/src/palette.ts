import { z } from "zod";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const PaletteRoles = z.object({
  bg: Hex,
  panel: Hex,
  card: Hex,
  muted: Hex,
  hover: Hex,
  border: Hex,
  fg: Hex,
  mfg: Hex,
  dim: Hex,
  blue: Hex,
  purple: Hex,
  green: Hex,
  red: Hex,
  amber: Hex,
  hold: Hex,
  accent: Hex,
  agent: Hex,
});
export type PaletteRoles = z.infer<typeof PaletteRoles>;

export const PaletteScheme = z.enum(["dark", "light"]);

export const CustomTheme = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scheme: PaletteScheme,
  roles: PaletteRoles,
});
export type CustomTheme = z.infer<typeof CustomTheme>;

export const StoredPalette = z.object({
  active: z.object({ dark: z.string().optional(), light: z.string().optional() }).default({}),
  drafts: z.record(z.string(), PaletteRoles.partial()).default({}),
  custom: z.array(CustomTheme).default([]),
});
export type StoredPalette = z.infer<typeof StoredPalette>;
