import { useCallback } from "react";
import { usePref } from "../lib/local-pref";

export const PANEL_WIDTH_KEY = "kibo.projectAgent.width";
export const PANEL_MIN = 360;
export const PANEL_MAX = 720;
export const PANEL_DEFAULT = 440;
export const PANEL_STEP = 16;

export const clampWidth = (width: number): number =>
  Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(width)));

export function usePanelWidth(): [number, (width: number) => void] {
  const [raw, setRaw] = usePref(PANEL_WIDTH_KEY, String(PANEL_DEFAULT));
  const parsed = Number(raw);
  const width = Number.isFinite(parsed) ? clampWidth(parsed) : PANEL_DEFAULT;
  const set = useCallback((next: number) => setRaw(String(clampWidth(next))), [setRaw]);
  return [width, set];
}
