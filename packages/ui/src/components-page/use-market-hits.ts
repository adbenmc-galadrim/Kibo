import type { ComponentKind, MarketHit, MarketSourceInfo } from "@kibo/schema";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import { marketErrorText } from "../lib/market-errors";

export type MarketQuery = { query: string; sourceId: string | null; kind: ComponentKind | null };

export function useMarketHits(sources: MarketSourceInfo[] | null, q: MarketQuery) {
  const [hits, setHits] = useState<MarketHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const { query, sourceId, kind } = q;
  useEffect(() => {
    if (!sources?.length) return;
    const ticket = ++latest.current;
    client
      .rpc({ method: "searchMarket", query, ...(sourceId ? { sourceId } : {}), ...(kind ? { kind } : {}) })
      .then((h) => {
        if (ticket !== latest.current) return;
        setHits(h);
        setError(null);
      })
      .catch((e: unknown) => ticket === latest.current && setError(marketErrorText(e)));
  }, [sources, query, sourceId, kind]);
  return { hits, error };
}

export function useMarketSources() {
  const [sources, setSources] = useState<MarketSourceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    client
      .rpc({ method: "listMarketSources" })
      .then(setSources)
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, []);
  return { sources, error };
}
