import type { DesignFrame } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../../api";

export type Thumb =
  | { state: "loading" }
  | { state: "ready"; frame: DesignFrame }
  | { state: "failed"; error: unknown };
export type DesignThumbs = {
  thumbs: ReadonlyMap<string, Thumb>;
  refresh(url: string): void;
  refreshing(url: string): boolean;
};
type Entry = { thumb: Thumb; busy: boolean };

const LOADING: Entry = { thumb: { state: "loading" }, busy: true };

const withEntry = (map: ReadonlyMap<string, Entry>, url: string, entry: Entry) =>
  new Map(map).set(url, entry);

export function useDesignThumbs(urls: readonly string[]): DesignThumbs {
  const [entries, setEntries] = useState<ReadonlyMap<string, Entry>>(() => new Map());
  const loads = useRef(new Map<string, number>());
  const load = useCallback((url: string, refresh: boolean) => {
    const id = (loads.current.get(url) ?? 0) + 1;
    loads.current.set(url, id);
    const current = () => loads.current.get(url) === id;
    const settle = (thumb: Thumb) =>
      current() && setEntries((m) => withEntry(m, url, { thumb, busy: false }));
    setEntries((m) => {
      const thumb = m.get(url)?.thumb;
      return withEntry(m, url, thumb?.state === "ready" ? { thumb, busy: true } : LOADING);
    });
    client
      .rpc({ method: "getDesignFrame", url, refresh })
      .then((frame) => settle({ state: "ready", frame }))
      .catch((error: unknown) => settle({ state: "failed", error }));
  }, []);
  const key = urls.join("\n");
  useEffect(() => {
    const wanted = new Set(key.split("\n").filter(Boolean));
    for (const url of wanted) if (!loads.current.has(url)) load(url, false);
    const gone = [...loads.current.keys()].filter((url) => !wanted.has(url));
    for (const url of gone) loads.current.delete(url);
    if (gone.length > 0) setEntries((m) => new Map([...m].filter(([url]) => wanted.has(url))));
  }, [key, load]);
  useEffect(() => () => loads.current.clear(), []);
  const thumbs = new Map(urls.map((url) => [url, (entries.get(url) ?? LOADING).thumb]));
  return {
    thumbs,
    refresh: (url) => {
      if (loads.current.has(url)) load(url, true);
    },
    refreshing: (url) => entries.get(url)?.busy === true && thumbs.get(url)?.state === "ready",
  };
}
