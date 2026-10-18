import { useEffect } from "react";
import { useNarrowScreen } from "../shell/nav/use-narrow-screen";

const DOCK_VAR = "--project-agent-w";
const EDGE_VAR = "--project-agent-edge";
const DOCK_RULE = 1;

export function usePanelDock(open: boolean, width: number): { overlay: boolean } {
  const overlay = useNarrowScreen();
  const edge = `${width + DOCK_RULE}px`;
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement.style;
    root.setProperty(EDGE_VAR, edge);
    if (!overlay) root.setProperty(DOCK_VAR, edge);
    return () => {
      root.removeProperty(EDGE_VAR);
      root.removeProperty(DOCK_VAR);
    };
  }, [open, overlay, edge]);
  return { overlay };
}
