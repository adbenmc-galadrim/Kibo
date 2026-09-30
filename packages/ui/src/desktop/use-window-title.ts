import { useEffect } from "react";
import { inTauri } from "../shell/workspace-actions";
import { windowTitle } from "./window-title";

export function useWindowTitle(tabTitle: string | null): void {
  useEffect(() => {
    const title = windowTitle(tabTitle);
    document.title = title;
    if (!inTauri()) return;
    import("./install")
      .then((m) => m.setNativeTitle(title))
      .catch((e: unknown) => console.error("[kibo] cannot set the window title", e));
  }, [tabTitle]);
}
