import type { Spotlight } from "@kibo/schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { type PageIntent, pageIntents } from "./page-intents";

function usePageIntent(pageId: string): Spotlight | null {
  const [entry, setEntry] = useState<PageIntent | null>(() => pageIntents.take(pageId));
  useEffect(() => {
    const latch = () => {
      const next = pageIntents.take(pageId);
      if (next !== null) setEntry(next);
    };
    latch();
    return pageIntents.subscribe(latch);
  }, [pageId]);
  return useMemo(() => (entry === null ? null : { ...entry.intent }), [entry]);
}

function useStableAddress(address: Spotlight | null): Spotlight | null {
  const stable = useRef(address);
  if (JSON.stringify(stable.current) !== JSON.stringify(address)) stable.current = address;
  return stable.current;
}

export function usePageSpotlight(pageId: string, address: Spotlight | null): Spotlight | null {
  const intent = usePageIntent(pageId);
  const stable = useStableAddress(address);
  return stable ?? intent;
}
