import { useShownTabs } from "../tabs/use-shown-tabs";
import type { TabsApi } from "../tabs/use-tabs";
import type { useShellDialogs } from "./use-shell-dialogs";
import { useWorkspaceKeys } from "./use-workspace-keys";

type Dialogs = Pick<ReturnType<typeof useShellDialogs>, "dialogs" | "palette" | "set" | "setPalette">;

export function useWorkspaceTabs(allTabs: TabsApi, shell: Dialogs, toggleAgent: () => void): TabsApi {
  const tabs = useShownTabs(allTabs);
  const { dialogs, palette, set, setPalette } = shell;
  useWorkspaceKeys({ tabs, dialogs, palette, set, setPalette, toggleAgent });
  return tabs;
}
