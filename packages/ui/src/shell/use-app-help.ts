import { useEffect } from "react";
import { type HelpDialog, helpPatch } from "./help-dialogs";
import type { DialogsState } from "./ShellDialogs";

export function useAppHelp(set: (patch: Partial<DialogsState>) => void): void {
  useEffect(() => {
    const open = (key: HelpDialog) => set(helpPatch(key));
    import("./help-boot").then(
      (m) => m.startHelp(open),
      (e: unknown) => console.error("help entry points unavailable", e),
    );
  }, [set]);
}
