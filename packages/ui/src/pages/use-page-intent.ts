import type { Spotlight } from "@kibo/schema";
import { useEffect, useRef, useState } from "react";
import { pageIntents } from "./page-intents";

export function usePageIntent(pageId: string): Spotlight | null {
  const [intent, setIntent] = useState<Spotlight | null>(() => pageIntents.take(pageId));
  useEffect(() => {
    const latch = () => {
      const next = pageIntents.take(pageId);
      if (next !== null) setIntent(next);
    };
    latch();
    return pageIntents.subscribe(latch);
  }, [pageId]);
  return intent;
}

const sameSpotlight = (a: Spotlight | null, b: Spotlight | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function usePageSpotlight(pageId: string, address: Spotlight | null): Spotlight | null {
  const next = usePageIntent(pageId) ?? address;
  const stable = useRef(next);
  if (!sameSpotlight(stable.current, next)) stable.current = next;
  return stable.current;
}
