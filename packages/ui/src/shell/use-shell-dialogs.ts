import { useCallback, useState } from "react";
import { type DialogsState, NO_DIALOG } from "./ShellDialogs";

export type PaletteRequest = { newTab: boolean };

export function useShellDialogs() {
  const [dialogs, setDialogs] = useState<DialogsState>(NO_DIALOG);
  const [focusRun, setFocusRun] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteRequest | null>(null);
  const set = useCallback((patch: Partial<DialogsState>) => setDialogs((d) => ({ ...d, ...patch })), []);
  const clearFocus = useCallback(() => setFocusRun(null), []);
  return { dialogs, set, focusRun, setFocusRun, clearFocus, palette, setPalette };
}
