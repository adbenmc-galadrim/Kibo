import type { AgentsState, Page, ProjectMeta, ProjectSnapshot } from "@kibo/schema";
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
import { Bot, LayoutGrid, ListOrdered, Plus, Settings } from "lucide-react";
import { fr } from "../i18n/fr";
import { pageIcon } from "../registry";
import { navigate, openScreen, type Route } from "../route";
import { KiboLogo } from "./KiboLogo";

type Props = {
  projects: ProjectMeta[];
  active: ProjectSnapshot | null;
  route: Route;
  agents: AgentsState | null;
  onNewProject: () => void;
  onNewPage: (parentId: string | null) => void;
};

export function AppSidebar({ projects, active, route, agents, onNewProject, onNewPage }: Props) {
  const inAgents = route.screen === "agents" || route.screen === "queue";
  const children = (parentId: string | null): Page[] =>
    active?.pages.filter((p) => p.parentId === parentId) ?? [];
  const renderPages = (parentId: string | null) =>
    children(parentId).map((page) => {
      const Icon = pageIcon(page, active?.instances ?? []);
      return (
        <SidebarMenuSubItem key={page.id}>
          <SidebarMenuSubButton
            isActive={route.pageId === page.id}
            onClick={() => navigate(route.projectId, page.id)}
          >
            <Icon />
            <span>{page.title}</span>
          </SidebarMenuSubButton>
          {children(page.id).length > 0 && <SidebarMenuSub>{renderPages(page.id)}</SidebarMenuSub>}
        </SidebarMenuSubItem>
      );
    });

  return (
    <Sidebar>
      <SidebarHeader>
        <span className="flex items-center gap-2 px-2 py-1 text-sm font-semibold">
          <KiboLogo className="size-5" decorative />
          {fr.app.name}
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route.projectId === null && route.screen === null}
                onClick={() => navigate(null)}
              >
                <LayoutGrid />
                <span>{fr.nav.overview}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={inAgents} onClick={() => openScreen("agents")}>
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
                    <SidebarMenuSubButton asChild isActive={route.screen === "queue"}>
                      <button type="button" onClick={() => openScreen("queue")}>
                        <ListOrdered />
                        <span>{fr.nav.queue}</span>
                      </button>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{fr.nav.projects}</SidebarGroupLabel>
          <SidebarGroupAction aria-label={fr.nav.newProject} onClick={onNewProject}>
            <Plus />
          </SidebarGroupAction>
          <SidebarMenu>
            {projects.map((p) => (
              <SidebarMenuItem key={p.id}>
                <SidebarMenuButton
                  isActive={route.projectId === p.id && !route.pageId}
                  onClick={() => navigate(p.id)}
                >
                  <span className="size-2 rounded-[2px]" style={{ background: p.color }} />
                  <span>{p.name}</span>
                </SidebarMenuButton>
                {route.projectId === p.id && (
                  <>
                    <SidebarMenuAction aria-label={fr.nav.newPage} onClick={() => onNewPage(null)}>
                      <Plus />
                    </SidebarMenuAction>
                    {children(null).length > 0 && <SidebarMenuSub>{renderPages(null)}</SidebarMenuSub>}
                  </>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={route.screen === "domains"} onClick={() => openScreen("domains")}>
              <Settings />
              <span>{fr.nav.settings}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
