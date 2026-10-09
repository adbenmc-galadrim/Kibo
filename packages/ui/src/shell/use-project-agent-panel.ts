import { isInbox, type ProjectSnapshot } from "@kibo/schema";
import { useCallback } from "react";
import { usePref } from "../lib/local-pref";
import { canEdit } from "../state/access";
import { useOpened } from "./use-opened";

export const PANEL_OPEN_KEY = "kibo.projectAgent.open";

export type ProjectAgentPanelState = {
  available: boolean;
  open: boolean;
  opened: boolean;
  toggle(): void;
  close(): void;
};

export function useProjectAgentPanel(project: ProjectSnapshot | null): ProjectAgentPanelState {
  const [pref, setPref] = usePref(PANEL_OPEN_KEY, "0");
  const available = project !== null && !isInbox(project.meta.id) && canEdit(project);
  const toggle = useCallback(() => {
    if (available) setPref(pref === "1" ? "0" : "1");
  }, [available, pref, setPref]);
  const close = useCallback(() => setPref("0"), [setPref]);
  const open = available && pref === "1";
  return { available, open, opened: useOpened(open), toggle, close };
}
