import { useCallback } from "react";
import { usePref } from "../lib/local-pref";

export const WRAP_KEY = "kibo.wrap";

export function useWrap(): [boolean, (on: boolean) => void] {
  const [value, setValue] = usePref(WRAP_KEY, "on");
  const setWrap = useCallback((on: boolean) => setValue(on ? "on" : "off"), [setValue]);
  return [value !== "off", setWrap];
}
