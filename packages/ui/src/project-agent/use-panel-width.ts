import { useCallback } from "react";
import { usePref } from "../lib/local-pref";

export const PANEL_WIDTH_KEY = "kibo.projectAgent.width";
export const PANEL_MIN = 340;
export const PANEL_MAX = 720;
export const PANEL_DEFAULT = 340;
export const PANEL_STEP = 16;

export const clampWidth = (width: number): number =>
  Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(width)));

export function usePanelWidth(
  key: string = PANEL_WIDTH_KEY,
  fallback: number = PANEL_DEFAULT,
): [number, (width: number) => void] {
  const [raw, setRaw] = usePref(key, String(fallback));
  const parsed = Number(raw);
  const width = Number.isFinite(parsed) ? clampWidth(parsed) : fallback;
  const set = useCallback((next: number) => setRaw(String(clampWidth(next))), [setRaw]);
  return [width, set];
}
