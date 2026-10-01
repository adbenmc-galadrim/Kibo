import type { FileRef, TabTarget } from "@kibo/schema";
import type { PaletteAction } from "../palette/palette-items";
import { targetToHash } from "../tabs/target-hash";
import type { DialogsState } from "./ShellDialogs";

type SetDialogs = (patch: Partial<DialogsState>) => void;
type Go = (target: TabTarget | null, newTab?: boolean) => void;

type PaletteDeps = {
  set: SetDialogs;
  setFocusRun(id: string | null): void;
  go: Go;
  activeProjectId: string | null;
  cycleTheme(): void;
};

export function paletteActionHandler(d: PaletteDeps): (a: PaletteAction) => void {
  return (a) => {
    if (a.kind === "newProject") return d.set({ newProject: true });
    if (a.kind === "toggleTheme") return d.cycleTheme();
    if (a.kind === "reply") return d.setFocusRun(a.runId);
    if (a.kind === "assign") return d.set({ assign: { projectId: null, ticketId: a.ticketId } });
    if (a.projectId !== d.activeProjectId) d.go({ kind: "project", projectId: a.projectId });
    if (a.kind === "newPage") d.set({ newPageParent: null });
    if (a.kind === "newTicket") d.set({ newTicket: { parentId: a.parentId, projectId: a.projectId } });
  };
}

type FileTabDeps = { editRequests: Set<string>; set: SetDialogs; go: Go };

export function fileTabOpener(d: FileTabDeps): (ref: FileRef, edit: boolean) => void {
  return (ref, edit) => {
    const target: TabTarget = {
      kind: "file",
      projectId: ref.projectId,
      worktree: ref.worktree,
      path: ref.path,
      line: ref.line,
    };
    if (edit) d.editRequests.add(targetToHash(target));
    d.set({ preview: null });
    d.go(target, true);
  };
}
