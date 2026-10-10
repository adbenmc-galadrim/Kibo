import { useCallback, useState } from "react";
import { readSessionPref, writeSessionPref } from "../session-pref";

export const DOCK_HEIGHT_KEY = "kibo.agents.dock.height";
export const DOCK_MIN = 160;
export const DOCK_STEP = 16;
const DEFAULT_RATIO = 0.45;
const MAX_RATIO = 0.8;

const defaultHeight = (): number => Math.round(window.innerHeight * DEFAULT_RATIO);

export const clampHeight = (height: number): number =>
  Math.round(Math.min(window.innerHeight * MAX_RATIO, Math.max(DOCK_MIN, height)));

function storedHeight(): number {
  const parsed = Number(readSessionPref(DOCK_HEIGHT_KEY) ?? Number.NaN);
  return Number.isFinite(parsed) ? clampHeight(parsed) : defaultHeight();
}

export function useDockHeight(): { height: number; set(height: number): void; reset(): void } {
  const [height, setHeight] = useState(storedHeight);
  const set = useCallback((next: number) => {
    const clamped = clampHeight(next);
    writeSessionPref(DOCK_HEIGHT_KEY, String(clamped));
    setHeight(clamped);
  }, []);
  const reset = useCallback(() => {
    writeSessionPref(DOCK_HEIGHT_KEY, null);
    setHeight(defaultHeight());
  }, []);
  return { height, set, reset };
}
