import type { Spotlight } from "@kibo/schema";
import { useSpotlight } from "@kibo/sdk";
import { useEffect, useRef } from "react";

export function useNewFeatureIntent(open: () => void): void {
  const target = useSpotlight();
  const handled = useRef<Spotlight | null>(null);
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    if (target?.kind !== "newFeature" || handled.current === target) return;
    handled.current = target;
    latest.current();
  }, [target]);
}
