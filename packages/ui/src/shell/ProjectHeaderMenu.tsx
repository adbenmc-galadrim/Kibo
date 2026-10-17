import { isInbox, type ProjectCommand, type ProjectMeta } from "@kibo/schema";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ContextMenuEntries, DropdownMenuEntries } from "@kibo/sdk/ui/menu-entries";
import { SidebarMenuAction } from "@kibo/sdk/ui/sidebar";
import { Ellipsis, LayoutDashboard } from "lucide-react";
import { type ReactNode, useState } from "react";
import { client } from "../api";
import { ProjectFilesDialog } from "../files/lazy-files";
import { fr } from "../i18n/fr";
import { frProject } from "../i18n/fr-project";
import { frShare } from "../i18n/fr-share";
import { frTracking } from "../i18n/fr-tracking";
import { addOverviewPage } from "./nav/overview-page";
import { addPlanningPage } from "./nav/planning-page";
import { type ProjectMenuActions, projectMenuEntries } from "./project-menu";

export type ProjectHeaderMenuProps = {
  project: ProjectMeta;
  shifted: boolean;
  editable: boolean;
  actions: Omit<ProjectMenuActions, "files" | "planning">;
  onPlanningAdded: ((pageId: string) => void) | null;
  onOverviewAdded?: ((pageId: string) => void) | null;
  children: ReactNode;
};

export function ProjectHeaderMenu({
  project,
  shifted,
  editable,
  actions,
  onPlanningAdded,
  onOverviewAdded = null,
  children,
}: ProjectHeaderMenuProps) {
  const run = (command: ProjectCommand) => client.rpc({ method: "command", projectId: project.id, command });
  const planning = onPlanningAdded
    ? () =>
        void addPlanningPage(run).then(onPlanningAdded, (e: unknown) =>
          console.error("[kibo-ui] planning page not added", e),
        )
    : null;
  const overview: MenuEntry[] = onOverviewAdded
    ? [
        {
          label: frTracking.addOverview,
          icon: LayoutDashboard,
          onSelect: () =>
            void addOverviewPage(run).then(onOverviewAdded, (e: unknown) =>
              console.error("[kibo-ui] overview page not added", e),
            ),
        },
      ]
    : [];
  const [filesOpen, setFilesOpen] = useState(false);
  const listed = projectMenuEntries({
    editable,
    texts: {
      newPage: fr.nav.newPage,
      planning: frTracking.addPlanning,
      share: frShare.action,
      edit: fr.nav.editProject,
      files: frProject.files,
      remove: fr.nav.deleteProject,
    },
    actions: { ...actions, planning, files: isInbox(project.id) ? null : () => setFilesOpen(true) },
  });
  const entries = editable ? [...listed.slice(0, 1), ...overview, ...listed.slice(1)] : listed;
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
            showOnHover
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
      {filesOpen && <ProjectFilesDialog projectId={project.id} onClose={() => setFilesOpen(false)} />}
    </>
  );
}
