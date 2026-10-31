import { type SpotlightApi, useSdk, useSpotlight } from "@kibo/sdk";
import { type RefObject, useEffect, useRef, useState } from "react";

const SPOTLIGHT_MS = 1500;

type SpotlightMotion = "bounce" | "fade";

const playedBy = new WeakMap<SpotlightApi, Set<string>>();

function playedOf(api: SpotlightApi): Set<string> {
  const known = playedBy.get(api);
  if (known) return known;
  const played = new Set<string>();
  playedBy.set(api, played);
  return played;
}

const reducedMotion = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useSpotlightCard(questionId: string): {
  ref: RefObject<HTMLElement | null>;
  spotlit: SpotlightMotion | null;
} {
  const api = useSdk().spotlight;
  const target = useSpotlight();
  const ref = useRef<HTMLElement | null>(null);
  const [spotlit, setSpotlit] = useState<SpotlightMotion | null>(null);
  const aimed = target?.kind === "question" && target.id === questionId;
  useEffect(() => {
    const el = ref.current;
    const played = playedOf(api);
    if (!aimed || el === null || played.has(questionId)) return;
    played.add(questionId);
    const reduce = reducedMotion();
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    setSpotlit(reduce ? "fade" : "bounce");
  }, [aimed, api, questionId]);
  useEffect(() => {
    if (spotlit === null) return;
    const timer = setTimeout(() => setSpotlit(null), SPOTLIGHT_MS);
    return () => clearTimeout(timer);
  }, [spotlit]);
  return { ref, spotlit };
}
