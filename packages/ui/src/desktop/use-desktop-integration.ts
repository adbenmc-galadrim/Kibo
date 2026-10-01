import { useEffect } from "react";
import { inTauri } from "../shell/workspace-actions";

export function useDesktopIntegration(): void {
  useEffect(() => {
    if (!inTauri()) return;
    let off: (() => void) | null = null;
    let alive = true;
    import("./install").then(
      (m) => {
        if (alive) off = m.installDesktop();
      },
      (e: unknown) => console.error("[kibo] desktop integration failed to load", e),
    );
    return () => {
      alive = false;
      off?.();
    };
  }, []);
}
