import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { type RefObject, useMemo } from "react";
import { canEdit } from "../state/access";
import type { Host } from "./Host";
import type { DialogsState } from "./ShellDialogs";
import type { ProjectAgentTab } from "./use-project-agent-panel";

type Deps = {
  activeProjectId: string | null;
  projectRef: RefObject<ProjectSnapshot | null>;
  set(patch: Partial<DialogsState>): void;
  go(target: TabTarget | null, newTab?: boolean, keep?: boolean): void;
  openView: Host["openView"];
  openRun(runId: string): void;
  answerRun(runId: string): void;
  showProjectAgent(tab: ProjectAgentTab): void;
};

export function useWorkspaceHost(d: Deps): Host {
  const { activeProjectId, projectRef, set, go, openView, openRun, answerRun, showProjectAgent } = d;
  return useMemo<Host>(
    () => ({
      openTicket: (ticketId) => {
        if (activeProjectId) set({ sheet: { projectId: activeProjectId, ticketId } });
      },
      openNewTicket: (nt) => {
        if (projectRef.current && !canEdit(projectRef.current)) return;
        set({ newTicket: activeProjectId ? { ...nt, projectId: activeProjectId } : nt });
      },
      openAssign: (ticketId) => set({ assign: { projectId: null, ticketId } }),
      openFile: (ref) => set({ preview: ref }),
      openTarget: (target, opts) => go(target, opts?.newTab, opts?.keep),
      openView,
      openRun,
      answerRun,
      openProjectAgent: ({ tab }) => showProjectAgent(tab),
      projectId: activeProjectId,
    }),
    [activeProjectId, projectRef, set, go, openView, openRun, answerRun, showProjectAgent],
  );
}
