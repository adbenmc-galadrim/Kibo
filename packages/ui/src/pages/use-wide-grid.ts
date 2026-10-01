import { useEffect, useState } from "react";
import { WIDE_QUERY } from "../lib/format-grid";

const wideNow = (): boolean =>
  typeof window.matchMedia !== "function" || window.matchMedia(WIDE_QUERY).matches;

export function useWideGrid(): boolean {
  const [wide, setWide] = useState(wideNow);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    onChange();
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}
