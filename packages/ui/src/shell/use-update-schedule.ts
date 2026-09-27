import { useEffect } from "react";
import { inTauri } from "./workspace-actions";

const loadUpdates = () => import("../updates/use-update");

export function useUpdateSchedule(enabled: boolean = inTauri()): void {
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let stop: (() => void) | null = null;
    loadUpdates().then(
      (updates) => {
        if (live) stop = updates.startUpdateSchedule();
      },
      (e: unknown) => console.error("[kibo-ui] update schedule unavailable", e),
    );
    return () => {
      live = false;
      stop?.();
    };
  }, [enabled]);
}
