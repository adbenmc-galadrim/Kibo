import type { AgentsState, Page, ProjectMeta, ProjectSnapshot, Screen, TabTarget } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@kibo/sdk/ui/sidebar";
import {
  Bot,
  GitCommitHorizontal,
  Inbox,
  LayoutGrid,
  List,
  ListOrdered,
  Plus,
  Puzzle,
  Search,
  Settings,
} from "lucide-react";
import type { MouseEvent } from "react";
import { fr } from "../i18n/fr";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { canEdit } from "../state/access";
import { JoinProjectEntry } from "./lazy-screens";
import { type Link, ProjectEntry } from "./ProjectEntry";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Props = {
  className?: string;
  projects: ProjectMeta[];
  active: ProjectSnapshot | null;
  activeTarget: TabTarget | null;
  screen: Screen | null;
  agents: AgentsState | null;
  changesCount: number | null;
  mineCount: number | null;
  inboxCount: number | null;
  workspaceName: string | null;
  workspaceIcon: string | null;
  onOpen(target: TabTarget | null, newTab: boolean): void;
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

type AgentsEntryProps = { screen: Screen | null; agents: AgentsState | null; link: Link };

function AgentsEntry({ screen, agents, link }: AgentsEntryProps) {
  const inAgents = screen === "agents" || screen === "queue";
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={inAgents} {...link(screenTarget("agents"))}>
        <Bot />
        <span>{fr.nav.agents}</span>
      </SidebarMenuButton>
      {agents && (
        <SidebarMenuBadge className="gap-1.5">
          {agents.host.used}
          {agents.runs.some((r) => r.state === "waiting_input") && (
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
          )}
        </SidebarMenuBadge>
      )}
      {inAgents && (
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={screen === "queue"}>
              <button type="button" {...link(screenTarget("queue"))}>
                <ListOrdered />
                <span>{fr.nav.queue}</span>
              </button>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar(p: Props) {
  const { active, activeTarget, screen, changesCount, onOpen } = p;
  const editable = active !== null && canEdit(active);
  const onTarget = (kind: TabTarget["kind"], projectId: string) =>
    activeTarget !== null &&
    activeTarget.kind !== "screen" &&
    activeTarget.kind === kind &&
    activeTarget.projectId === projectId;
  const link: Link = (target) => ({
    onClick: (e: MouseEvent) => onOpen(target, wantsNewTab(e)),
    onAuxClick: (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      onOpen(target, true);
    },
  });
  const changesEntry = (projectId: string) =>
    changesCount !== null && (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={onTarget("changes", projectId)}>
          <button
            type="button"
            aria-label={`${fr.nav.changes} · ${fr.nav.changesCount(changesCount)}`}
            {...link({ kind: "changes", projectId, worktree: null })}
          >
            <GitCommitHorizontal />
            <span>{fr.nav.changes}</span>
            {changesCount > 0 && (
              <span className="ml-auto font-mono text-2xs text-muted-foreground tabular-nums">
                {changesCount}
              </span>
            )}
          </button>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );

  return (
    <Sidebar className={cn("select-none", p.className)}>
      <SidebarHeader>
        <WorkspaceSwitcher
          name={p.workspaceName ?? fr.workspace.defaultName}
          icon={p.workspaceIcon}
          onSettings={() => onOpen(screenTarget("workspace"), false)}
        />
        <button
          type="button"
          onClick={p.onSearch}
          className="flex h-8 items-center gap-2 rounded-md border bg-background px-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search aria-hidden className="size-4" />
          <span className="flex-1 text-left">{fr.nav.search}</span>
          <kbd className="font-mono text-3xs">{shortcutLabel(["K"], isMac())}</kbd>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={activeTarget === null} {...link(null)}>
                <LayoutGrid />
                <span>{fr.nav.overview}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={screen === "mine"} {...link(screenTarget("mine"))}>
                <List />
                <span>{fr.nav.mine}</span>
              </SidebarMenuButton>
              {p.mineCount !== null && p.mineCount > 0 && <SidebarMenuBadge>{p.mineCount}</SidebarMenuBadge>}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={screen === "inbox"} {...link(screenTarget("inbox"))}>
                <Inbox />
                <span>{fr.nav.inbox}</span>
              </SidebarMenuButton>
              {p.inboxCount !== null && p.inboxCount > 0 && (
                <SidebarMenuBadge>{p.inboxCount}</SidebarMenuBadge>
              )}
            </SidebarMenuItem>
            <AgentsEntry screen={screen} agents={p.agents} link={link} />
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{fr.nav.projects}</SidebarGroupLabel>
          <SidebarGroupAction aria-label={fr.nav.newProject} onClick={p.onNewProject}>
            <Plus />
          </SidebarGroupAction>
          <SidebarMenu>
            {p.projects.map((project) => {
              const current = active?.meta.id === project.id;
              return (
                <SidebarMenuItem key={project.id}>
                  <ProjectEntry
                    project={project}
                    active={current ? active : null}
                    activeTarget={activeTarget}
                    projectActive={onTarget("project", project.id)}
                    editable={current && editable}
                    menuEditable={!current || editable}
                    current={current}
                    trailing={changesEntry(project.id) || null}
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
            <JoinProjectEntry onJoin={p.onJoin} />
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={screen === "components"} {...link(screenTarget("components"))}>
              <Puzzle />
              <span>{fr.nav.components}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={screen !== null && SETTINGS_SCREENS.has(screen)}
              {...link(screenTarget("general"))}
            >
              <Settings />
              <span>{fr.nav.settings}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
