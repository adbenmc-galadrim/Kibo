import { type StoredPalette as Palette, StoredPalette } from "@kibo/schema";
import { readPref, usePref, writePref } from "../lib/local-pref";
import type { Scheme } from "./palette-roles";
import { activeTheme, EMPTY_PALETTE } from "./palette-state";
import { PALETTE_TOKEN_NAMES, paletteTokens } from "./palette-tokens";

export const PALETTE_KEY = "kibo.palette";

export function parsePalette(raw: string): Palette {
  if (raw === "") return EMPTY_PALETTE;
  try {
    const parsed = StoredPalette.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
    console.error("stored palette is invalid", parsed.error);
  } catch (e) {
    console.error("stored palette is unreadable", e);
  }
  return EMPTY_PALETTE;
}

export const readPalette = (): Palette => parsePalette(readPref(PALETTE_KEY, ""));

export function writePalette(next: Palette, scheme: Scheme): void {
  writePref(PALETTE_KEY, JSON.stringify(next));
  applyPalette(scheme, next);
}

export function applyPalette(scheme: Scheme, palette: Palette = readPalette()): void {
  const { style } = document.documentElement;
  const active = activeTheme(palette, scheme);
  if (active.pristineDefault) {
    for (const name of PALETTE_TOKEN_NAMES) style.removeProperty(name);
    return;
  }
  for (const [name, value] of Object.entries(paletteTokens(active.roles))) style.setProperty(name, value);
}

export const useStoredRaw = (): string => usePref(PALETTE_KEY, "")[0];
