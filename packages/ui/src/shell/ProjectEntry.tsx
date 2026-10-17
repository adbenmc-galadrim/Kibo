import type { Page, ProjectMeta, ProjectSnapshot, TabTarget } from "@kibo/schema";
import { SidebarMenuAction } from "@kibo/sdk/ui/sidebar";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { MouseEvent } from "react";
import { fr } from "../i18n/fr";
import { ProjectHeaderMenu } from "./lazy-screens";
import { NavRow } from "./nav/NavRow";
import { overviewMissing } from "./nav/overview-missing";
import { planningMissing } from "./nav/planning-missing";
import { ProjectPages } from "./ProjectPages";

export type Link = (target: TabTarget | null) => {
  onClick(e: MouseEvent): void;
  onAuxClick(e: MouseEvent): void;
  onDoubleClick(e: MouseEvent): void;
};

export type ProjectEntryProps = {
  project: ProjectMeta & { demo?: boolean };
  active: ProjectSnapshot | null;
  activeTarget: TabTarget | null;
  projectActive: boolean;
  editable: boolean;
  menuEditable: boolean;
  current: boolean;
  link: Link;
  onOpen(target: TabTarget, newTab: boolean, keep?: boolean): void;
  onNewPage(parentId: string | null): void;
  onRenamePage(page: Page): void;
  onDeletePage(page: Page): void;
  onShare(): void;
  onEdit(): void;
  onDelete(): void;
};

function ProjectLead({ color, open }: { color: string; open: boolean }) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <>
      <Chevron size={13} absoluteStrokeWidth className="k-chev" />
      <b aria-hidden className="k-dot" style={{ background: color }} />
    </>
  );
}

export function ProjectEntry({ project, active, current, editable, link, ...p }: ProjectEntryProps) {
  const newPage = () => {
    if (!current) p.onOpen({ kind: "project", projectId: project.id }, false);
    p.onNewPage(null);
  };
  const onPlanningAdded =
    active && editable && planningMissing(active)
      ? (pageId: string) => p.onOpen({ kind: "page", projectId: project.id, pageId }, false)
      : null;
  const onOverviewAdded =
    active && editable && overviewMissing(active)
      ? (pageId: string) => p.onOpen({ kind: "page", projectId: project.id, pageId }, false)
      : null;
  const header = (
    <>
      <ProjectHeaderMenu
        project={project}
        shifted={editable}
        editable={p.menuEditable}
        onPlanningAdded={onPlanningAdded}
        onOverviewAdded={onOverviewAdded}
        actions={{ newPage, share: p.onShare, edit: p.onEdit, remove: p.onDelete }}
      >
        <NavRow
          label={project.name}
          active={p.projectActive}
          count={project.demo ? fr.nav.demo : null}
          lead={<ProjectLead color={project.color} open={active !== null} />}
          {...link({ kind: "project", projectId: project.id })}
        />
      </ProjectHeaderMenu>
      {editable && (
        <SidebarMenuAction showOnHover aria-label={fr.nav.newPage} onClick={() => p.onNewPage(null)}>
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
      onOpen={p.onOpen}
      onNewPage={p.onNewPage}
      onRenamePage={p.onRenamePage}
      onDeletePage={p.onDeletePage}
    />
  );
}
