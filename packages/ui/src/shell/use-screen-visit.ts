import type { Screen, TabTarget } from "@kibo/schema";
import { useCallback, useState } from "react";

type Go = (target: TabTarget | null, newTab?: boolean, keep?: boolean) => void;

export function useScreenVisit(screen: Screen | null, go: Go) {
  const [visit, setVisit] = useState(0);
  const open = useCallback(
    (target: TabTarget | null, newTab = false, keep?: boolean) => {
      if (!newTab && target?.kind === "screen" && target.screen === screen) setVisit((n) => n + 1);
      go(target, newTab, keep);
    },
    [screen, go],
  );
  return { visit, open };
}
