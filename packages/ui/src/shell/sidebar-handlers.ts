import type { Page } from "@kibo/schema";
import type { HelpDialog } from "./help-dialogs";
import { helpPatch } from "./help-dialogs";
import type { DialogsState } from "./ShellDialogs";
import type { PaletteRequest } from "./use-shell-dialogs";

type Set = (patch: Partial<DialogsState>) => void;

export const sidebarHandlers = (set: Set, setPalette: (request: PaletteRequest | null) => void) => ({
  onHelp: (key: HelpDialog) => set(helpPatch(key)),
  onSearch: () => setPalette({ newTab: false }),
  onNewProject: () => set({ newProject: true }),
  onNewPage: (parentId: string | null) => set({ newPageParent: parentId }),
  onRenamePage: (page: Page) => set({ renamePage: page }),
  onDeletePage: (page: Page) => set({ deletePage: page }),
  onEditProject: (projectId: string) => set({ editProject: projectId }),
  onDeleteProject: (projectId: string) => set({ deleteProject: projectId }),
});
