import type { FileRef, ProjectSnapshot, Session } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { Bell } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AgentPanel } from "../agents/AgentPanel";
import { AgentsPage } from "../agents/AgentsPage";
import { AssignDialog } from "../agents/AssignDialog";
import { ProfileSheet } from "../agents/ProfileSheet";
import { QueuePage } from "../agents/QueuePage";
import { useRunNotifications } from "../agents/use-run-notifications";
import { NewPageDialog } from "../dialogs/NewPageDialog";
import { NewProjectDialog } from "../dialogs/NewProjectDialog";
import { NewTicketDialog } from "../dialogs/NewTicketDialog";
import { fr } from "../i18n/fr";
import { PageView } from "../pages/PageView";
import { ProjectHome } from "../pages/ProjectHome";
import { type Route, useRoute } from "../route";
import { DomainsPage } from "../settings/DomainsPage";
import { useAgents, useConfig, useNow } from "../state/use-agents";
import { useProject, useProjects } from "../state/use-projects";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumb } from "./Breadcrumb";
import { type Host, HostProvider } from "./Host";
import { NotifyButton } from "./NotifyButton";
import { Overview } from "./Overview";
import { ScreenActions } from "./ScreenActions";
import { TicketSheet } from "./TicketSheet";

type Props = { viewer: string; notifications: Session["notifications"] };

function crumbsFor(route: Route, project: ProjectSnapshot | null, page: string | null): string[] {
  if (route.screen === "agents") return [fr.nav.agents];
  if (route.screen === "queue") return [fr.nav.agents, fr.nav.queue];
  if (route.screen === "domains") return [fr.nav.settings, fr.nav.domains];
  return [project?.meta.name ?? fr.nav.overview, ...(project && page ? [page] : [])];
}

export function Shell({ viewer, notifications }: Props) {
  const route = useRoute();
  const projects = useProjects();
  const project = useProject(route.projectId);
  const agents = useAgents();
  const config = useConfig();
  const now = useNow();
  const [newProject, setNewProject] = useState(false);
  const [newPageParent, setNewPageParent] = useState<string | null | undefined>(undefined);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState<NewTicketDefaults | null>(null);
  const [assign, setAssign] = useState<{ ticketId: string | null } | null>(null);
  const [newProfile, setNewProfile] = useState(false);
  const [focusRun, setFocusRun] = useState<string | null>(null);
  const [, setFileRef] = useState<FileRef | null>(null);
  const clearFocus = useCallback(() => setFocusRun(null), []);
  const launch = useCallback(() => setAssign({ ticketId: null }), []);
  const host = useMemo<Host>(
    () => ({
      openTicket: setTicketId,
      openNewTicket: setNewTicket,
      openAssign: (id) => setAssign({ ticketId: id }),
      openFile: setFileRef,
    }),
    [],
  );
  useRunNotifications(agents, notifications === "browser");
  if (!projects) return null;

  const page = project?.pages.find((p) => p.id === route.pageId) ?? null;
  const onProject = !route.screen && project;
  return (
    <HostProvider host={host}>
      <SidebarProvider>
        <AppSidebar
          projects={projects}
          active={project}
          route={route}
          agents={agents}
          onNewProject={() => setNewProject(true)}
          onNewPage={(parentId) => setNewPageParent(parentId)}
        />
        <SidebarInset className="h-svh min-w-0">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <Breadcrumb
              items={crumbsFor(route, project, page?.title ?? null)}
              heading={route.screen === "agents" || route.screen === "queue"}
            />
            <span className="flex-1" />
            <ScreenActions screen={route.screen} agents={agents} onNewProfile={() => setNewProfile(true)} />
            {notifications === "browser" ? (
              <NotifyButton />
            ) : (
              <Bell aria-hidden className="size-4 text-muted-foreground" />
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-auto" data-viewer={viewer}>
            {route.screen === "agents" && agents && config && (
              <AgentsPage state={agents} config={config} now={now} />
            )}
            {route.screen === "queue" && agents && config && (
              <QueuePage state={agents} profiles={config.profiles} now={now} onAnswer={setFocusRun} />
            )}
            {route.screen === "domains" && config && <DomainsPage config={config} projects={projects} />}
            {!route.screen && !route.projectId && (
              <Overview viewer={viewer} projects={projects} onNewProject={() => setNewProject(true)} />
            )}
            {onProject && !route.pageId && (
              <ProjectHome project={project} onNewPage={() => setNewPageParent(null)} />
            )}
            {onProject && page && <PageView key={page.id} project={project} page={page} viewer={viewer} />}
          </div>
          <AgentPanel onLaunch={launch} focusRunId={focusRun} onFocused={clearFocus} />
        </SidebarInset>
        <NewProjectDialog open={newProject} onOpenChange={setNewProject} count={projects.length} />
        {project && newPageParent !== undefined && (
          <NewPageDialog
            projectId={project.meta.id}
            projectName={project.meta.name}
            parentId={newPageParent}
            open
            onOpenChange={(o) => !o && setNewPageParent(undefined)}
          />
        )}
        {project && ticketId && (
          <TicketSheet
            project={project}
            ticketId={ticketId}
            domains={config?.domains ?? []}
            onClose={() => setTicketId(null)}
            onAssign={() => {
              setAssign({ ticketId });
              setTicketId(null);
            }}
          />
        )}
        {project && newTicket && (
          <NewTicketDialog
            project={project}
            viewer={viewer}
            defaults={newTicket}
            onClose={() => setNewTicket(null)}
          />
        )}
        {assign && (
          <AssignDialog
            project={project}
            ticketId={assign.ticketId}
            config={config}
            onClose={() => setAssign(null)}
          />
        )}
        {newProfile && config && agents && (
          <ProfileSheet
            profile={null}
            config={config}
            hostSlots={agents.host.hostSlots}
            onClose={() => setNewProfile(false)}
          />
        )}
      </SidebarProvider>
    </HostProvider>
  );
}
