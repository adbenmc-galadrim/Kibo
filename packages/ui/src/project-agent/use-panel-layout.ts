import { useCallback } from "react";
import { usePref } from "../lib/local-pref";

export const PANEL_WIDE_KEY = "kibo.projectAgent.wide";
export const PANEL_LIST_KEY = "kibo.projectAgent.list";
export const WIDE_WIDTH = 720;

function useFlag(key: string, fallback: boolean): [boolean, (on: boolean) => void] {
  const [raw, setRaw] = usePref(key, fallback ? "1" : "0");
  const value = raw === "1" ? true : raw === "0" ? false : fallback;
  const set = useCallback((on: boolean) => setRaw(on ? "1" : "0"), [setRaw]);
  return [value, set];
}

export function usePanelLayout(): {
  wide: boolean;
  list: boolean;
  setWide(on: boolean): void;
  setList(on: boolean): void;
} {
  const [wide, setWide] = useFlag(PANEL_WIDE_KEY, false);
  const [list, setList] = useFlag(PANEL_LIST_KEY, true);
  return { wide, list, setWide, setList };
}
