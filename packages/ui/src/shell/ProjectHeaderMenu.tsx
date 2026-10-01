import type { ProjectMeta } from "@kibo/schema";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries } from "@kibo/sdk/ui/menu-entries";
import { SidebarMenuAction } from "@kibo/sdk/ui/sidebar";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { frShare } from "../i18n/fr-share";
import { type ProjectMenuActions, projectMenuEntries } from "./project-menu";

export type ProjectHeaderMenuProps = {
  project: ProjectMeta;
  current: boolean;
  shifted: boolean;
  editable: boolean;
  actions: ProjectMenuActions;
  children: ReactNode;
};

export function ProjectHeaderMenu({
  project,
  current,
  shifted,
  editable,
  actions,
  children,
}: ProjectHeaderMenuProps) {
  const entries = projectMenuEntries({
    editable,
    texts: {
      newPage: fr.nav.newPage,
      share: frShare.action,
      edit: fr.nav.editProject,
      remove: fr.nav.deleteProject,
    },
    actions,
  });
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            showOnHover={!current}
            className={shifted ? "right-7" : undefined}
            aria-label={frShare.menu(project.name)}
          >
            <Ellipsis />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuEntries entries={entries} />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
