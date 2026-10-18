import { isInbox, type ProjectSnapshot } from "@kibo/schema";
import { useCallback, useState } from "react";
import { usePref } from "../lib/local-pref";
import { canEdit } from "../state/access";
import { useNarrowScreen } from "./nav/use-narrow-screen";
import { useOpened } from "./use-opened";

export const PANEL_OPEN_KEY = "kibo.projectAgent.open";

export type ProjectAgentTab = "conversation" | "signals";

export type ProjectAgentPanelState = {
  available: boolean;
  open: boolean;
  opened: boolean;
  tab: ProjectAgentTab;
  setTab(tab: ProjectAgentTab): void;
  toggle(): void;
  show(tab: ProjectAgentTab): void;
  close(): void;
};

export function useProjectAgentPanel(project: ProjectSnapshot | null): ProjectAgentPanelState {
  const [wide, setWide] = usePref(PANEL_OPEN_KEY, "0");
  const [overlay, setOverlay] = useState("0");
  const narrow = useNarrowScreen();
  const pref = narrow ? overlay : wide;
  const setPref = narrow ? setOverlay : setWide;
  const [tab, setTab] = useState<ProjectAgentTab>("conversation");
  const available = project !== null && !isInbox(project.meta.id) && canEdit(project);
  const show = useCallback(
    (next: ProjectAgentTab) => {
      if (!available) return;
      setTab(next);
      setPref("1");
    },
    [available, setPref],
  );
  const toggle = useCallback(() => {
    if (!available) return;
    if (pref === "1") setPref("0");
    else show("conversation");
  }, [available, pref, setPref, show]);
  const close = useCallback(() => setPref("0"), [setPref]);
  const open = available && pref === "1";
  return { available, open, opened: useOpened(open), tab, setTab, toggle, show, close };
}
