import {
  type Page,
  type ProjectMeta,
  type ProjectSnapshot,
  type Screen,
  type TabTarget,
  targetProjectId,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Sidebar, SidebarMenu, SidebarMenuItem, useSidebar } from "@kibo/sdk/ui/sidebar";
import { House, Search, Settings2 } from "lucide-react";
import type { MouseEvent } from "react";
import { fr } from "../i18n/fr";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import type { HelpDialog } from "./help-dialogs";
import { RailProjectMenu } from "./nav/lazy-nav";
import { NavRow } from "./nav/NavRow";
import { ProjectsHeader } from "./nav/ProjectsHeader";
import { RailBadge } from "./nav/RailBadge";
import { SidebarToggle } from "./nav/SidebarToggle";
import { useNarrowScreen } from "./nav/use-narrow-screen";
import { type Link, ProjectEntry } from "./ProjectEntry";
import { UserMenu } from "./UserMenu";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Props = {
  className?: string;
  projects: (ProjectMeta & { demo?: boolean })[];
  active: ProjectSnapshot | null;
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  activeTarget: TabTarget | null;
  screen: Screen | null;
  workspaceName: string | null;
  workspaceIcon: string | null;
  viewer: string;
  onOpen(target: TabTarget | null, newTab: boolean, keep?: boolean): void;
  onHelp(key: HelpDialog): void;
  onSearch(): void;
  onNewProject(): void;
  onNewPage(parentId: string | null): void;
  onRenamePage(page: Page): void;
  onDeletePage(page: Page): void;
  onEditProject(projectId: string): void;
  onDeleteProject(projectId: string): void;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;

const screenTarget = (screen: Screen): TabTarget => ({ kind: "screen", screen });
const SETTINGS_SCREENS: ReadonlySet<Screen> = new Set([
  "general",
  "appearance",
  "integrations",
  "shortcuts",
  "workspace",
]);

function SearchButton({ onSearch }: { onSearch(): void }) {
  return (
    <button type="button" onClick={onSearch} className="k-search k-focus">
      <Search size={14} absoluteStrokeWidth className="k-14" />
      <span>{fr.nav.search}</span>
      <kbd>{shortcutLabel(["K"], isMac())}</kbd>
    </button>
  );
}

export function AppSidebar(p: Props) {
  const { active, activeTarget, screen, onOpen } = p;
  const editable = active !== null;
  const onTarget = (kind: TabTarget["kind"], projectId: string) =>
    activeTarget !== null && activeTarget.kind === kind && targetProjectId(activeTarget) === projectId;
  const link: Link = (target) => ({
    onClick: (e: MouseEvent) => onOpen(target, wantsNewTab(e)),
    onAuxClick: (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      onOpen(target, true);
    },
    onDoubleClick: (e: MouseEvent) => {
      e.preventDefault();
      onOpen(target, false, true);
    },
  });
  const narrow = useNarrowScreen();
  const { state, isMobile } = useSidebar();
  const rail = narrow && !isMobile && state === "collapsed";
  const activePageId = activeTarget?.kind === "page" ? activeTarget.pageId : null;

  return (
    <Sidebar
      collapsible={narrow ? "icon" : "offcanvas"}
      className={cn("select-none border-(--tracking-soft)", p.className)}
    >
      <div className="k-sidebar">
        <div className="k-head">
          <WorkspaceSwitcher
            name={p.workspaceName ?? fr.workspace.defaultName}
            icon={p.workspaceIcon}
            onSettings={() => onOpen(screenTarget("workspace"), false)}
          />
          <span className="flex-1" />
          <SidebarToggle />
        </div>
        <SearchButton onSearch={p.onSearch} />
        <ul className="k-list mt-2.5 shrink-0">
          <li>
            <NavRow icon={House} label={fr.nav.overview} active={activeTarget === null} {...link(null)} />
          </li>
        </ul>
        <ProjectsHeader onNewProject={p.onNewProject} />
        <SidebarMenu className="scroll-shadow min-h-0 flex-1 gap-[2px] overflow-y-auto">
          {p.projects.map((project) => {
            const current = active?.meta.id === project.id;
            if (rail)
              return (
                <SidebarMenuItem key={project.id}>
                  <RailProjectMenu
                    name={project.name}
                    projectId={project.id}
                    snapshot={current ? active : (p.snapshots.get(project.id) ?? null)}
                    activePageId={current ? activePageId : null}
                    onOpen={onOpen}
                  >
                    <RailBadge name={project.name} color={project.color} current={current} />
                  </RailProjectMenu>
                </SidebarMenuItem>
              );
            return (
              <SidebarMenuItem key={project.id} className="flex flex-col">
                <ProjectEntry
                  project={project}
                  active={current ? active : null}
                  activeTarget={activeTarget}
                  projectActive={onTarget("project", project.id)}
                  editable={current && editable}
                  menuEditable={!current || editable}
                  current={current}
                  link={link}
                  onOpen={onOpen}
                  onNewPage={p.onNewPage}
                  onRenamePage={p.onRenamePage}
                  onDeletePage={p.onDeletePage}
                  onEdit={() => p.onEditProject(project.id)}
                  onDelete={() => p.onDeleteProject(project.id)}
                />
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <NavRow
          icon={Settings2}
          label={fr.nav.settings}
          active={screen !== null && SETTINGS_SCREENS.has(screen)}
          {...link(screenTarget("general"))}
        />
        <UserMenu viewer={p.viewer} onOpen={(t) => onOpen(t, false)} onHelp={p.onHelp} />
      </div>
    </Sidebar>
  );
}
