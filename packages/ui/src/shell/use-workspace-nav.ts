import type { TabTarget } from "@kibo/schema";
import { useCallback } from "react";
import type { TabsApi } from "../tabs/use-tabs";
import type { DialogsState } from "./ShellDialogs";

type Deps = { tabs: TabsApi; set(patch: Partial<DialogsState>): void; forget(projectId: string): void };

export type WorkspaceNav = {
  go(target: TabTarget | null, newTab?: boolean, keep?: boolean): void;
  goHome(): void;
  launch(): void;
  closeProject(projectId: string): void;
};

export function useWorkspaceNav({ tabs, set, forget }: Deps): WorkspaceNav {
  const { open, dispatch } = tabs;
  const go = useCallback(
    (target: TabTarget | null, newTab = false, keep?: boolean) =>
      open(target, keep === undefined ? { newTab } : { newTab, keep }),
    [open],
  );
  const goHome = useCallback(() => go(null), [go]);
  const launch = useCallback(() => set({ assign: { projectId: null, ticketId: null } }), [set]);
  const closeProject = (projectId: string) => {
    dispatch({ type: "closeProject", projectId });
    forget(projectId);
    go(null);
  };
  return { go, goHome, launch, closeProject };
}
