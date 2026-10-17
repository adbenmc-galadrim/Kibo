import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { useMemo } from "react";
import type { ProjectGit } from "../code/use-project-git";
import { resolveWorktree } from "../code/use-worktrees";
import type { PaletteContext } from "../palette/palette-items";
import { useExecutionShown } from "../state/use-app-settings";
import type { DialogsState } from "./ShellDialogs";

type Args = Omit<PaletteContext, "activeTicketId" | "executionShown"> & {
  active: TabTarget | null;
  project: ProjectSnapshot | null;
  ticketProject: ProjectSnapshot | null;
  git: ProjectGit;
  dialogs: DialogsState;
};

const sheetProjectOf = (a: Args): ProjectSnapshot | null => {
  const id = a.dialogs.sheet?.projectId ?? null;
  if (id === a.project?.meta.id) return a.project;
  return id ? (a.snapshots.get(id) ?? null) : null;
};

export function useWorkspaceView(a: Args) {
  const executionShown = useExecutionShown();
  const { active, git, ticketProject, projects, snapshots, recents, activeProjectId, agents } = a;
  const branch =
    active?.kind === "changes" ? (resolveWorktree(git.worktrees, active.worktree)?.branch ?? null) : null;
  const isDirty = (t: TabTarget) =>
    t.kind === "changes" &&
    t.projectId === ticketProject?.meta.id &&
    (t.worktree === null || t.worktree === git.main?.path) &&
    (git.changesCount ?? 0) > 0;
  const activeTicketId = active?.kind === "ticket" ? active.ticketId : (a.dialogs.sheet?.ticketId ?? null);
  const paletteContext = useMemo<PaletteContext>(
    () => ({ projects, snapshots, recents, activeProjectId, activeTicketId, agents, executionShown }),
    [projects, snapshots, recents, activeProjectId, activeTicketId, agents, executionShown],
  );
  return { branch, isDirty, sheetProject: sheetProjectOf(a), paletteContext };
}
