import { SidebarInset, SidebarProvider, SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { useState } from "react";
import { NewPageDialog } from "../dialogs/NewPageDialog";
import { NewProjectDialog } from "../dialogs/NewProjectDialog";
import { ProjectHome } from "../pages/ProjectHome";
import { useRoute } from "../route";
import { useProject, useProjects } from "../state/use-projects";
import { AppSidebar } from "./AppSidebar";
import { Overview } from "./Overview";

export function Shell({ viewer }: { viewer: string }) {
  const route = useRoute();
  const projects = useProjects();
  const project = useProject(route.projectId);
  const [newProject, setNewProject] = useState(false);
  const [newPageParent, setNewPageParent] = useState<string | null | undefined>(undefined);
  if (!projects) return null;

  const page = project?.pages.find((p) => p.id === route.pageId) ?? null;
  return (
    <SidebarProvider>
      <AppSidebar
        projects={projects}
        active={project}
        route={route}
        onNewProject={() => setNewProject(true)}
        onNewPage={(parentId) => setNewPageParent(parentId)}
      />
      <SidebarInset>
        <header className="flex h-10 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">
            {project ? `${project.meta.name}${page ? ` · ${page.title}` : ""}` : ""}
          </span>
        </header>
        <main className="min-h-0 flex-1" data-viewer={viewer}>
          {!route.projectId && <Overview projects={projects} onNewProject={() => setNewProject(true)} />}
          {project && !page && <ProjectHome project={project} onNewPage={() => setNewPageParent(null)} />}
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
    </SidebarProvider>
  );
}
