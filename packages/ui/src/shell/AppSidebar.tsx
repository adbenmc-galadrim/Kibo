import {
  type AgentsState,
  type Page,
  type ProjectMeta,
  type ProjectSnapshot,
  type Screen,
  type TabTarget,
  targetProjectId,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Sidebar, SidebarMenu, SidebarMenuItem } from "@kibo/sdk/ui/sidebar";
import { House, Inbox, Search, Settings2, Ticket } from "lucide-react";
import type { MouseEvent } from "react";
import { fr } from "../i18n/fr";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { canEdit } from "../state/access";
import type { HelpDialog } from "./help-dialogs";
import { AgentsEntry } from "./lazy-screens";
import { ExecutionGate } from "./nav/ExecutionGate";
import { NavRow } from "./nav/NavRow";
import { ProjectsHeader } from "./nav/ProjectsHeader";
import { SidebarToggle } from "./nav/SidebarToggle";
import { type Link, ProjectEntry } from "./ProjectEntry";
import { UserMenu } from "./UserMenu";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Props = {
  className?: string;
  projects: (ProjectMeta & { demo?: boolean })[];
  active: ProjectSnapshot | null;
  activeTarget: TabTarget | null;
  screen: Screen | null;
  agents: AgentsState | null;
  changes: { count: number | null } | null;
  mineCount: number | null;
  inboxCount: number | null;
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
  onShare(projectId: string): void;
  onEditProject(projectId: string): void;
  onDeleteProject(projectId: string): void;
  onJoin(): void;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;
const count = (n: number | null): string | null => (n !== null && n > 0 ? String(n) : null);

const screenTarget = (screen: Screen): TabTarget => ({ kind: "screen", screen });
const SETTINGS_SCREENS: ReadonlySet<Screen> = new Set([
  "general",
  "appearance",
  "domains",
  "integrations",
  "security",
  "sources",
  "sync",
  "shortcuts",
  "workspace",
]);

function SearchButton({ onSearch }: { onSearch(): void }) {
  return (
    <button type="button" onClick={onSearch} className="k-search k-focus">
      <Search aria-hidden size={14} absoluteStrokeWidth className="k-14" />
      <span>{fr.nav.search}</span>
      <kbd>{shortcutLabel(["K"], isMac())}</kbd>
    </button>
  );
}

export function AppSidebar(p: Props) {
  const { active, activeTarget, screen, onOpen } = p;
  const editable = active !== null && canEdit(active);
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
  const changesOf = active && p.changes ? active.meta.id : null;

  return (
    <Sidebar className={cn("select-none border-(--tracking-soft)", p.className)}>
      <div className="k-sidebar">
        <div className="k-head">
          <WorkspaceSwitcher
            name={p.workspaceName ?? fr.workspace.defaultName}
            icon={p.workspaceIcon}
            onSettings={() => onOpen(screenTarget("workspace"), false)}
            onComponents={() => onOpen(screenTarget("components"), false)}
            onChanges={
              changesOf
                ? () => onOpen({ kind: "changes", projectId: changesOf, worktree: null }, false)
                : null
            }
          />
          <span className="flex-1" />
          <SidebarToggle />
        </div>
        <SearchButton onSearch={p.onSearch} />
        <ul className="k-list mt-2.5 shrink-0">
          <li>
            <NavRow icon={House} label={fr.nav.overview} active={activeTarget === null} {...link(null)} />
          </li>
          <li>
            <NavRow
              icon={Ticket}
              label={fr.nav.mine}
              active={screen === "mine"}
              count={count(p.mineCount)}
              {...link(screenTarget("mine"))}
            />
          </li>
          <li>
            <NavRow
              icon={Inbox}
              label={fr.nav.inbox}
              active={screen === "inbox"}
              count={count(p.inboxCount)}
              {...link(screenTarget("inbox"))}
            />
          </li>
          <ExecutionGate>
            <li className="k-list">
              <AgentsEntry screen={screen} agents={p.agents} link={link} />
            </li>
          </ExecutionGate>
        </ul>
        <ProjectsHeader onNewProject={p.onNewProject} onJoin={p.onJoin} />
        <SidebarMenu className="min-h-0 flex-1 gap-[2px] overflow-y-auto">
          {p.projects.map((project) => {
            const current = active?.meta.id === project.id;
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
                  onShare={() => p.onShare(project.id)}
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
