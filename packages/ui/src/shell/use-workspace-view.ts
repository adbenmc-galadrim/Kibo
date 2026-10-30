import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { useMemo } from "react";
import type { PaletteContext } from "../palette/palette-items";
import type { DialogsState } from "./ShellDialogs";

type Args = Omit<PaletteContext, "activeTicketId"> & {
  active: TabTarget | null;
  project: ProjectSnapshot | null;
  dialogs: DialogsState;
};

const sheetProjectOf = (a: Args): ProjectSnapshot | null => {
  const id = a.dialogs.sheet?.projectId ?? null;
  if (id === a.project?.meta.id) return a.project;
  return id ? (a.snapshots.get(id) ?? null) : null;
};

export function useWorkspaceView(a: Args) {
  const { active, projects, snapshots, recents, activeProjectId } = a;
  const activeTicketId = active?.kind === "ticket" ? active.ticketId : (a.dialogs.sheet?.ticketId ?? null);
  const paletteContext = useMemo<PaletteContext>(
    () => ({ projects, snapshots, recents, activeProjectId, activeTicketId }),
    [projects, snapshots, recents, activeProjectId, activeTicketId],
  );
  return { sheetProject: sheetProjectOf(a), paletteContext };
}
