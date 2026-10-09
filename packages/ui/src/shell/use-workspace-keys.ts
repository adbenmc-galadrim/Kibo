import { useDestructiveKeyGuard } from "../tabs/key-guard";
import { useKeepOnEdit } from "../tabs/use-keep-on-edit";
import { useTabShortcuts } from "../tabs/use-tab-shortcuts";
import type { TabsApi } from "../tabs/use-tabs";
import { helpPatch } from "./help-dialogs";
import { anyDialogOpen, type useShellDialogs } from "./use-shell-dialogs";

type Dialogs = ReturnType<typeof useShellDialogs>;
type Deps = Pick<Dialogs, "dialogs" | "palette" | "set" | "setPalette"> & {
  tabs: TabsApi;
  toggleAgent(): void;
};

export function useWorkspaceKeys({ tabs, dialogs, palette, set, setPalette, toggleAgent }: Deps): void {
  useDestructiveKeyGuard();
  useKeepOnEdit(tabs, anyDialogOpen(dialogs, palette));
  useTabShortcuts((s) => {
    if (s.kind === "palette") return setPalette({ newTab: false });
    if (s.kind === "newTab") return setPalette({ newTab: true });
    if (s.kind === "activate") return tabs.dispatch({ type: "activateIndex", index: s.index });
    if (s.kind === "reopen") return tabs.reopen();
    if (s.kind === "help") return set(helpPatch("shortcutsHelp"));
    if (s.kind === "projectAgent") return toggleAgent();
    const id = tabs.state.activeId;
    if (!id) return;
    if (s.kind === "close") tabs.dispatch({ type: "close", id });
    if (s.kind === "togglePin")
      tabs.dispatch({ type: "pin", id, pinned: !tabs.state.tabs.find((t) => t.id === id)?.pinned });
  });
}
