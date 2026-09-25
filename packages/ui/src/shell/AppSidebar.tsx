import type { Page, ProjectMeta, ProjectSnapshot } from "@kibo/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@kibo/sdk/ui/sidebar";
import { Plus } from "lucide-react";
import { fr } from "../i18n/fr";
import { pageIcon } from "../registry";
import { navigate, type Route } from "../route";
import { KiboLogo } from "./KiboLogo";

type Props = {
  projects: ProjectMeta[];
  active: ProjectSnapshot | null;
  route: Route;
  onNewProject: () => void;
  onNewPage: (parentId: string | null) => void;
};

export function AppSidebar({ projects, active, route, onNewProject, onNewPage }: Props) {
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
              <SidebarMenuButton isActive={route.projectId === null} onClick={() => navigate(null)}>
                {fr.nav.overview}
              </SidebarMenuButton>
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
    </Sidebar>
  );
}
