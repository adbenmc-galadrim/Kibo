import { useCallback, useEffect, useState } from "react";
import { readSessionPref, writeSessionPref } from "../session-pref";

export const DOCK_HEIGHT_KEY = "kibo.agents.dock.height";
export const DOCK_MIN = 160;
export const DOCK_STEP = 16;
const DEFAULT_RATIO = 0.45;
const MAX_RATIO = 0.8;

const defaultHeight = (): number => Math.round(window.innerHeight * DEFAULT_RATIO);
const maxHeight = (): number => Math.round(window.innerHeight * MAX_RATIO);

export const clampHeight = (height: number): number =>
  Math.round(Math.min(maxHeight(), Math.max(DOCK_MIN, height)));

function storedHeight(): number | null {
  const parsed = Number(readSessionPref(DOCK_HEIGHT_KEY) ?? Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function useWindowMax(): number {
  const [max, setMax] = useState(maxHeight);
  useEffect(() => {
    const onResize = () => setMax(maxHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return max;
}

export function useDockHeight(): { height: number; max: number; set(height: number): void; reset(): void } {
  const max = useWindowMax();
  const [wanted, setWanted] = useState(storedHeight);
  const set = useCallback((next: number) => {
    const clamped = clampHeight(next);
    writeSessionPref(DOCK_HEIGHT_KEY, String(clamped));
    setWanted(clamped);
  }, []);
  const reset = useCallback(() => {
    writeSessionPref(DOCK_HEIGHT_KEY, null);
    setWanted(null);
  }, []);
  const height = Math.round(Math.min(max, Math.max(DOCK_MIN, wanted ?? defaultHeight())));
  return { height, max, set, reset };
}
