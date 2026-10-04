import type { Page, ProjectMeta, ProjectSnapshot, TabTarget } from "@kibo/schema";
import { SidebarMenuAction, SidebarMenuButton } from "@kibo/sdk/ui/sidebar";
import { Plus } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { fr } from "../i18n/fr";
import { ProjectHeaderMenu } from "./lazy-screens";
import { ProjectPages } from "./ProjectPages";

export type Link = (target: TabTarget | null) => {
  onClick(e: MouseEvent): void;
  onAuxClick(e: MouseEvent): void;
};

export type ProjectEntryProps = {
  project: ProjectMeta & { demo?: boolean };
  active: ProjectSnapshot | null;
  activeTarget: TabTarget | null;
  projectActive: boolean;
  editable: boolean;
  menuEditable: boolean;
  current: boolean;
  trailing: ReactNode;
  link: Link;
  onOpen(target: TabTarget, newTab: boolean): void;
  onNewPage(parentId: string | null): void;
  onRenamePage(page: Page): void;
  onDeletePage(page: Page): void;
  onShare(): void;
  onEdit(): void;
  onDelete(): void;
};

export function ProjectEntry({ project, active, current, editable, link, ...p }: ProjectEntryProps) {
  const newPage = () => {
    if (!current) p.onOpen({ kind: "project", projectId: project.id }, false);
    p.onNewPage(null);
  };
  const header = (
    <>
      <ProjectHeaderMenu
        project={project}
        current={current}
        shifted={editable}
        editable={p.menuEditable}
        actions={{ newPage, share: p.onShare, edit: p.onEdit, remove: p.onDelete }}
      >
        <SidebarMenuButton isActive={p.projectActive} {...link({ kind: "project", projectId: project.id })}>
          <span className="size-2 rounded-[2px]" style={{ background: project.color }} />
          <span>{project.name}</span>
          {project.demo && (
            <span className="rounded-sm bg-secondary px-1 text-3xs font-medium text-secondary-foreground">
              {fr.nav.demo}
            </span>
          )}
        </SidebarMenuButton>
      </ProjectHeaderMenu>
      {editable && (
        <SidebarMenuAction aria-label={fr.nav.newPage} onClick={() => p.onNewPage(null)}>
          <Plus />
        </SidebarMenuAction>
      )}
    </>
  );
  if (!active) return header;
  return (
    <ProjectPages
      project={active}
      activeTarget={p.activeTarget}
      header={header}
      trailing={p.trailing}
      onOpen={p.onOpen}
      onNewPage={p.onNewPage}
      onRenamePage={p.onRenamePage}
      onDeletePage={p.onDeletePage}
    />
  );
}
