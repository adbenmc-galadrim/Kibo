import { type DesignFrame, type DesignFrameKey, parseDesignUrl } from "@kibo/schema";
import { useCallback, useMemo, useState } from "react";
import type { ReferenceOption } from "./CompareBar";
import {
  COMPARE_OFF,
  type CompareAction,
  type CompareContext,
  type CompareState,
  compareReducer,
  normalizeCompare,
} from "./compare";
import { fr } from "./fr";

export type FrameTarget = { url: string; key: DesignFrameKey };
export type Comparison = {
  state: CompareState;
  available: boolean;
  references: ReferenceOption[];
  reference: FrameTarget | null;
  dispatch(action: CompareAction): void;
  seen(url: string, frame: DesignFrame | null): void;
};

type Stored = { scope: string; state: CompareState };

const keyOf = (url: string): DesignFrameKey | null => parseDesignUrl(url)?.key ?? null;

export function useCompare(frames: readonly string[], current: number): Comparison {
  const [names, setNames] = useState<ReadonlyMap<string, string | null>>(new Map());
  const keys = useMemo(() => frames.map(keyOf), [frames]);
  const imageIndexes = useMemo(
    () =>
      keys.flatMap((k, i) => {
        const url = frames[i];
        return k && k.provider !== "storybook" && url !== undefined && names.get(url) !== null ? [i] : [];
      }),
    [keys, frames, names],
  );
  const ctx: CompareContext = { imageIndexes, current };
  const scope = `${current}\n${frames.join("\n")}`;
  const [stored, setStored] = useState<Stored>({ scope, state: COMPARE_OFF });
  if (stored.scope !== scope) setStored({ scope, state: COMPARE_OFF });
  const state = normalizeCompare(stored.scope === scope ? stored.state : COMPARE_OFF, ctx);

  const dispatch = (action: CompareAction) =>
    setStored((s) => ({
      scope,
      state: compareReducer(normalizeCompare(s.scope === scope ? s.state : COMPARE_OFF, ctx), action, ctx),
    }));

  const seen = useCallback((url: string, frame: DesignFrame | null) => {
    const name = frame?.name ?? null;
    setNames((m) => (m.has(url) && m.get(url) === name ? m : new Map(m).set(url, name)));
  }, []);

  const referenceUrl = state.reference === null ? undefined : frames[state.reference];
  const referenceKey = state.reference === null ? null : (keys[state.reference] ?? null);
  return {
    state,
    available: keys[current]?.provider === "storybook" && imageIndexes.length > 0,
    references: imageIndexes.map((index) => {
      const key = keys[index];
      const url = frames[index] ?? "";
      const fallback = fr.compare.frame(index + 1, key ? fr.provider[key.provider] : "");
      return { index, label: names.get(url) ?? fallback };
    }),
    reference: referenceUrl && referenceKey ? { url: referenceUrl, key: referenceKey } : null,
    dispatch,
    seen,
  };
}
