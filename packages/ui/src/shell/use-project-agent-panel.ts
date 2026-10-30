import { isInbox, type ProjectSnapshot } from "@kibo/schema";
import { useCallback, useState } from "react";
import { usePref } from "../lib/local-pref";
import { useNarrowScreen } from "./nav/use-narrow-screen";
import { useOpened } from "./use-opened";

export const PANEL_OPEN_KEY = "kibo.projectAgent.open";

type ProjectAgentPanelState = {
  available: boolean;
  open: boolean;
  opened: boolean;
  toggle(): void;
  show(): void;
  close(): void;
};

export function useProjectAgentPanel(project: ProjectSnapshot | null): ProjectAgentPanelState {
  const [wide, setWide] = usePref(PANEL_OPEN_KEY, "0");
  const [overlay, setOverlay] = useState("0");
  const narrow = useNarrowScreen();
  const pref = narrow ? overlay : wide;
  const setPref = narrow ? setOverlay : setWide;
  const available = project !== null && !isInbox(project.meta.id);
  const show = useCallback(() => {
    if (available) setPref("1");
  }, [available, setPref]);
  const toggle = useCallback(() => {
    if (!available) return;
    setPref(pref === "1" ? "0" : "1");
  }, [available, pref, setPref]);
  const close = useCallback(() => setPref("0"), [setPref]);
  const open = available && pref === "1";
  return { available, open, opened: useOpened(open), toggle, show, close };
}
