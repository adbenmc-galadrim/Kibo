import { useCallback, useState } from "react";
import { type DialogsState, NO_DIALOG } from "./ShellDialogs";

export type PaletteRequest = { newTab: boolean };

export function anyDialogOpen(dialogs: DialogsState, palette: PaletteRequest | null): boolean {
  const { newProjectFocus: _focus, newPageParent, ...shown } = dialogs;
  if (palette !== null || newPageParent !== undefined) return true;
  return Object.values(shown).some((v) => v !== null && v !== false);
}

export function useShellDialogs() {
  const [dialogs, setDialogs] = useState<DialogsState>(NO_DIALOG);
  const [palette, setPalette] = useState<PaletteRequest | null>(null);
  const set = useCallback((patch: Partial<DialogsState>) => setDialogs((d) => ({ ...d, ...patch })), []);
  return { dialogs, set, palette, setPalette };
}
