import { useCallback } from "react";
import { usePref } from "../lib/local-pref";
import { DEFAULT_QUERY, type SortKey } from "./filter-components";

export const COMPONENTS_SORT_KEY = "kibo.components.sort";

export type ComponentsSort = { sort: SortKey; descending: boolean };

const SORT_KEYS: readonly SortKey[] = ["title", "version", "trust", "origin", "usage"];
const isSortKey = (v: string): v is SortKey => SORT_KEYS.some((k) => k === v);
const DEFAULT_SORT: ComponentsSort = { sort: DEFAULT_QUERY.sort, descending: DEFAULT_QUERY.descending };

export function parseSort(raw: string): ComponentsSort {
  const [key = "", direction] = raw.split(":");
  if (!isSortKey(key) || (direction !== "asc" && direction !== "desc")) return DEFAULT_SORT;
  return { sort: key, descending: direction === "desc" };
}

export const formatSort = (s: ComponentsSort): string => `${s.sort}:${s.descending ? "desc" : "asc"}`;

export function useComponentsSort(): [ComponentsSort, (next: ComponentsSort) => void] {
  const [raw, setRaw] = usePref(COMPONENTS_SORT_KEY, formatSort(DEFAULT_SORT));
  const set = useCallback((next: ComponentsSort) => setRaw(formatSort(next)), [setRaw]);
  return [parseSort(raw), set];
}
