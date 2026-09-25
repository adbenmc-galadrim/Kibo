import type { NewTicketDefaults } from "@kibo/sdk";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { useMemo, useState } from "react";
import { NewPageDialog } from "../dialogs/NewPageDialog";
import { NewProjectDialog } from "../dialogs/NewProjectDialog";
import { NewTicketDialog } from "../dialogs/NewTicketDialog";
import { PageView } from "../pages/PageView";
import { ProjectHome } from "../pages/ProjectHome";
import { useRoute } from "../route";
import { useProject, useProjects } from "../state/use-projects";
import { AppSidebar } from "./AppSidebar";
import { type Host, HostProvider } from "./Host";
import { Overview } from "./Overview";
import { TicketSheet } from "./TicketSheet";

export function Shell({ viewer }: { viewer: string }) {
  const route = useRoute();
  const projects = useProjects();
  const project = useProject(route.projectId);
  const [newProject, setNewProject] = useState(false);
  const [newPageParent, setNewPageParent] = useState<string | null | undefined>(undefined);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState<NewTicketDefaults | null>(null);
  const host = useMemo<Host>(() => ({ openTicket: setTicketId, openNewTicket: setNewTicket }), []);
  if (!projects) return null;

  const page = project?.pages.find((p) => p.id === route.pageId) ?? null;
  return (
    <HostProvider host={host}>
      <SidebarProvider>
        <AppSidebar
          projects={projects}
          active={project}
          route={route}
          onNewProject={() => setNewProject(true)}
          onNewPage={(parentId) => setNewPageParent(parentId)}
        />
        <SidebarInset className="min-w-0">
          <header className="flex h-10 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">
              {project ? `${project.meta.name}${page ? ` · ${page.title}` : ""}` : ""}
            </span>
          </header>
          <main className="min-h-0 flex-1" data-viewer={viewer}>
            {!route.projectId && <Overview projects={projects} onNewProject={() => setNewProject(true)} />}
            {project && !route.pageId && (
              <ProjectHome project={project} onNewPage={() => setNewPageParent(null)} />
            )}
            {project && page && <PageView key={page.id} project={project} page={page} viewer={viewer} />}
          </main>
        </SidebarInset>
        <NewProjectDialog open={newProject} onOpenChange={setNewProject} count={projects.length} />
        {project && newPageParent !== undefined && (
          <NewPageDialog
            projectId={project.meta.id}
            parentId={newPageParent}
            open
            onOpenChange={(o) => !o && setNewPageParent(undefined)}
          />
        )}
        {project && ticketId && (
          <TicketSheet project={project} ticketId={ticketId} onClose={() => setTicketId(null)} />
        )}
        {project && newTicket && (
          <NewTicketDialog
            project={project}
            viewer={viewer}
            defaults={newTicket}
            onClose={() => setNewTicket(null)}
          />
        )}
      </SidebarProvider>
    </HostProvider>
  );
}
