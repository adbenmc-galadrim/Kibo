import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { type RefObject, useMemo } from "react";
import { canEdit } from "../state/access";
import type { Host } from "./Host";
import type { DialogsState } from "./ShellDialogs";

type Deps = {
  activeProjectId: string | null;
  projectRef: RefObject<ProjectSnapshot | null>;
  set(patch: Partial<DialogsState>): void;
  go(target: TabTarget | null, newTab?: boolean, keep?: boolean): void;
  openView: Host["openView"];
  showProjectAgent(): void;
};

export function useWorkspaceHost(d: Deps): Host {
  const { activeProjectId, projectRef, set, go, openView, showProjectAgent } = d;
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
        if (projectRef.current && !canEdit(projectRef.current)) return;
        set({ newTicket: activeProjectId ? { ...nt, projectId: activeProjectId } : nt });
      },
      openFile: (ref) => set({ preview: ref }),
      openTarget: (target, opts) => go(target, opts?.newTab, opts?.keep),
      openView,
      openProjectAgent: showProjectAgent,
      projectId: activeProjectId,
    }),
    [activeProjectId, projectRef, set, go, openView, showProjectAgent],
  );
}
