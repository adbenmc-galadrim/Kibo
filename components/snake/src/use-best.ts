import type { KiboSdk } from "@kibo/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "best";

export function useBestScore(sdk: KiboSdk): [number, (score: number) => void] {
  const [best, setBest] = useState(0);
  const latest = useRef(0);
  useEffect(() => {
    let live = true;
    sdk.data.get<number>(KEY).then((stored) => {
      if (!live || typeof stored !== "number" || stored <= latest.current) return;
      latest.current = stored;
      setBest(stored);
    }, console.error);
    return () => {
      live = false;
    };
  }, [sdk]);
  const offer = useCallback(
    (score: number) => {
      if (score <= latest.current) return;
      latest.current = score;
      setBest(score);
      sdk.data.set(KEY, score).catch(console.error);
    },
    [sdk],
  );
  return [best, offer];
}
