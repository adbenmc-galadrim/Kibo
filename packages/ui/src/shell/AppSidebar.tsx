import type { AgentsState, Page, ProjectMeta, ProjectSnapshot, Screen, TabTarget } from "@kibo/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
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
import { pageIcon } from "../registry";
import { KiboLogo } from "./KiboLogo";

type Props = {
  className?: string;
  projects: ProjectMeta[];
  active: ProjectSnapshot | null;
  activeTarget: TabTarget | null;
  screen: Screen | null;
  agents: AgentsState | null;
  changesCount: number | null;
  mineCount: number | null;
  onOpen(target: TabTarget | null, newTab: boolean): void;
  onSearch(): void;
  onNewProject(): void;
  onNewPage(parentId: string | null): void;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;

type Link = (target: TabTarget | null) => {
  onClick(e: MouseEvent): void;
  onAuxClick(e: MouseEvent): void;
};
const screenTarget = (screen: Screen): TabTarget => ({ kind: "screen", screen });

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
  const children = (parentId: string | null): Page[] =>
    active?.pages.filter((x) => x.parentId === parentId) ?? [];
  const renderPages = (projectId: string, parentId: string | null) =>
    children(parentId).map((page) => {
      const Icon = pageIcon(page, active?.instances ?? []);
      return (
        <SidebarMenuSubItem key={page.id}>
          <SidebarMenuSubButton
            asChild
            isActive={
              onTarget("page", projectId) && activeTarget?.kind === "page" && activeTarget.pageId === page.id
            }
          >
            <button type="button" {...link({ kind: "page", projectId, pageId: page.id })}>
              <Icon />
              <span>{page.title}</span>
            </button>
          </SidebarMenuSubButton>
          {children(page.id).length > 0 && <SidebarMenuSub>{renderPages(projectId, page.id)}</SidebarMenuSub>}
        </SidebarMenuSubItem>
      );
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
    <Sidebar className={p.className}>
      <SidebarHeader>
        <span className="flex items-center gap-2 px-2 py-1 text-sm font-semibold">
          <KiboLogo className="size-5" decorative />
          {fr.app.name}
        </span>
        <button
          type="button"
          onClick={p.onSearch}
          className="flex h-8 items-center gap-2 rounded-md border bg-background px-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search aria-hidden className="size-4" />
          <span className="flex-1 text-left">{fr.nav.search}</span>
          <kbd className="font-mono text-3xs">⌘K</kbd>
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
                  <SidebarMenuButton
                    isActive={onTarget("project", project.id)}
                    {...link({ kind: "project", projectId: project.id })}
                  >
                    <span className="size-2 rounded-[2px]" style={{ background: project.color }} />
                    <span>{project.name}</span>
                  </SidebarMenuButton>
                  {current && (
                    <>
                      <SidebarMenuAction aria-label={fr.nav.newPage} onClick={() => p.onNewPage(null)}>
                        <Plus />
                      </SidebarMenuAction>
                      {(children(null).length > 0 || changesCount !== null) && (
                        <SidebarMenuSub>
                          {renderPages(project.id, null)}
                          {changesEntry(project.id)}
                        </SidebarMenuSub>
                      )}
                    </>
                  )}
                </SidebarMenuItem>
              );
            })}
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
            <SidebarMenuButton isActive={screen === "domains"} {...link(screenTarget("domains"))}>
              <Settings />
              <span>{fr.nav.settings}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
