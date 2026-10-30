import type { TabTarget } from "@kibo/schema";
import { useMemo } from "react";
import type { Host } from "./Host";
import type { DialogsState } from "./ShellDialogs";

type Deps = {
  activeProjectId: string | null;
  set(patch: Partial<DialogsState>): void;
  go(target: TabTarget | null, newTab?: boolean, keep?: boolean): void;
  openView: Host["openView"];
  showProjectAgent(): void;
};

export function useWorkspaceHost(d: Deps): Host {
  const { activeProjectId, set, go, openView, showProjectAgent } = d;
  return useMemo<Host>(
    () => ({
      openTicket: (ticketId) => {
        if (activeProjectId) set({ sheet: { projectId: activeProjectId, ticketId } });
      },
      openSprint: (sprintId) => {
        if (activeProjectId) set({ sprintSheet: { projectId: activeProjectId, sprintId } });
      },
      editProject: ({ field }) => {
        if (activeProjectId) set({ editProject: activeProjectId, editFocus: field });
      },
      openNewTicket: (nt) => {
        set({ newTicket: activeProjectId ? { ...nt, projectId: activeProjectId } : nt });
      },
      openFile: (ref) => set({ preview: ref }),
      openTarget: (target, opts) => go(target, opts?.newTab, opts?.keep),
      openView,
      openProjectAgent: showProjectAgent,
      projectId: activeProjectId,
    }),
    [activeProjectId, set, go, openView, showProjectAgent],
  );
}
