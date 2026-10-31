import {
  type AgentsState,
  iconUrl,
  type ProjectSummary,
  type TabTarget,
  type TicketView,
  targetProjectId,
} from "@kibo/schema";
import { SidebarInset } from "@kibo/sdk/ui/sidebar";
import { useCallback, useRef } from "react";
import { useDesktopIntegration } from "../desktop/use-desktop-integration";
import { useWindowTitle } from "../desktop/use-window-title";
import { projectDomainsOf } from "../lib/project-domains";
import { useRoute } from "../route";
import { useConfig } from "../state/use-agents";
import { describeTarget } from "../tabs/tab-title";
import { activeTarget } from "../tabs/tabs-model";
import { resolveProjectKey, targetToHash } from "../tabs/target-hash";
import { useHashSync } from "../tabs/use-hash-sync";
import type { TabsApi } from "../tabs/use-tabs";
import { cycleTheme } from "../theme";
import { AppSidebar } from "./AppSidebar";
import { ContentView } from "./ContentView";
import { useProjectGit } from "./git/use-project-git";
import { HostProvider } from "./Host";
import { ProjectAgentPanel } from "./lazy-screens";
import { RetiredRedirect } from "./nav/lazy-nav";
import { WorkspaceFrame } from "./nav/WorkspaceFrame";
import { PageActionsProvider } from "./page-actions";
import { ScreenView } from "./ScreenView";
import type { ShellProps } from "./Shell";
import { ShellDialogs } from "./ShellDialogs";
import { ShellHeader } from "./ShellHeader";
import { fileTabOpener, paletteActionHandler } from "./shell-actions";
import { sidebarHandlers } from "./sidebar-handlers";
import { usePageTransition } from "./transitions/use-page-transition";
import { useAppHelp } from "./use-app-help";
import { useOpenView, useSnapshotLookup } from "./use-open-view";
import { useProjectAgentPanel } from "./use-project-agent-panel";
import { useProjectFocus } from "./use-project-focus";
import { useProjectLanding } from "./use-project-landing";
import { useScreenVisit } from "./use-screen-visit";
import { useSheetAddress } from "./use-sheet-address";
import { useShellDialogs } from "./use-shell-dialogs";
import { useWorkspaceHost } from "./use-workspace-host";
import { useWorkspaceNav } from "./use-workspace-nav";
import { useWorkspaceSnapshots } from "./use-workspace-snapshots";
import { useWorkspaceTabs } from "./use-workspace-tabs";
import { useWorkspaceView } from "./use-workspace-view";
import { WorkspacePalette } from "./WorkspacePalette";

type WorkspaceProps = ShellProps & { projects: ProjectSummary[]; tabs: TabsApi; agents: AgentsState | null };

export function Workspace({ viewer, projects, tabs, agents }: WorkspaceProps) {
  const route = useRoute();
  const shell = useShellDialogs();
  const { dialogs, set, palette, setPalette } = shell;
  const sheetTickets = useRef<readonly TicketView[] | null>(null);
  const closeSheet = useCallback(() => set({ sheet: null }), [set]);
  const routeTarget = resolveProjectKey(route.target, projects);
  useHashSync(
    tabs,
    useSheetAddress(dialogs.sheet, () => sheetTickets.current, routeTarget, closeSheet),
  );
  const active = activeTarget(tabs.state);
  const screen = active?.kind === "screen" ? active.screen : null;
  const activeProjectId = active ? targetProjectId(active) : null;
  const { ticketProject, project, currentProject, forget } = useProjectFocus(activeProjectId);
  useProjectLanding(tabs, project);
  const snapshots = useWorkspaceSnapshots(projects);
  const config = useConfig();
  const git = useProjectGit(ticketProject?.meta.id ?? null, ticketProject?.meta.folder ?? null);
  const agentPanel = useProjectAgentPanel(project);
  useAppHelp(set);
  const editRequests = useRef(new Set<string>());

  const describe = (t: TabTarget) => describeTarget(t, { projects, snapshots, runs: agents?.runs });
  useWindowTitle(active ? describe(active).title : null);
  useDesktopIntegration();

  const { go, goHome, closeProject } = useWorkspaceNav({ tabs, forget });
  const views = useOpenView(currentProject, go, useSnapshotLookup(snapshots));
  const screenVisit = useScreenVisit(screen, go);

  const host = useWorkspaceHost({
    activeProjectId,
    set,
    go,
    openView: views.openView,
    showProjectAgent: agentPanel.show,
  });

  const shownTabs = useWorkspaceTabs(tabs, shell, agentPanel.toggle);

  const onAction = paletteActionHandler({ set, go, activeProjectId, cycleTheme });
  const openFileTab = fileTabOpener({ editRequests: editRequests.current, set, go });

  const { sheetProject, paletteContext } = useWorkspaceView({
    active,
    project,
    dialogs,
    projects,
    snapshots,
    recents: tabs.state.recents,
    activeProjectId,
  });
  sheetTickets.current = sheetProject?.tickets ?? null;

  const pageContent = usePageTransition(
    screen ? (
      <ScreenView key={`${screen}-${screenVisit.visit}`} screen={screen} config={config} />
    ) : (
      <ContentView
        target={active}
        viewer={viewer}
        projects={projects}
        snapshots={snapshots}
        project={project}
        domains={projectDomainsOf(project, config)}
        startEditing={active?.kind === "file" && editRequests.current.has(targetToHash(active))}
        onNewProject={() => set({ newProject: true })}
        onImportProject={() => set({ newProject: true, newProjectFocus: "folder" })}
        onNewPage={() => set({ newPageParent: null })}
        onOpen={(t, newTab) => go(t, newTab)}
        onOpenFile={(ref) => set({ preview: ref })}
        onOpenTicket={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
      />
    ),
    targetToHash(active),
  );

  return (
    <HostProvider host={host}>
      <PageActionsProvider>
        <WorkspaceFrame tabs={shownTabs} describe={describe} onNewTab={() => setPalette({ newTab: true })}>
          <AppSidebar
            className="top-(--tabbar-h) h-[calc(100svh-var(--tabbar-h))]!"
            projects={projects}
            active={project}
            activeTarget={active}
            screen={screen}
            workspaceName={config?.workspaceName ?? null}
            workspaceIcon={
              config?.workspaceIcon ? iconUrl({ kind: "workspace" }, config.workspaceIcon) : null
            }
            viewer={viewer}
            snapshots={snapshots}
            onOpen={screenVisit.open}
            {...sidebarHandlers(set, setPalette)}
          />
          <SidebarInset className="min-h-0 min-w-0 mr-(--project-agent-w)">
            <ShellHeader
              active={active}
              project={project}
              gitError={project ? git.error : null}
              agents={agents}
              agentPanel={agentPanel}
              onOpen={(t, keep) => go(t, false, keep)}
            />
            <RetiredRedirect target={active} onHome={goHome} />
            <div className="kibo-content min-h-0 flex-1 overflow-auto" data-viewer={viewer}>
              {pageContent}
            </div>
          </SidebarInset>
          {agentPanel.opened && project && (
            <ProjectAgentPanel
              key={project.meta.id}
              open={agentPanel.open}
              project={project}
              onClose={agentPanel.close}
            />
          )}
          <ShellDialogs
            state={dialogs}
            set={set}
            viewer={viewer}
            projects={projects}
            project={project}
            ticketProject={ticketProject}
            sheetProject={sheetProject}
            snapshots={snapshots}
            agents={agents}
            config={config}
            onOpenTarget={go}
            onOpenFileTab={openFileTab}
            onCloseProject={closeProject}
          />
          {views.dialog}
          <WorkspacePalette
            request={palette}
            onClose={() => setPalette(null)}
            context={paletteContext}
            onOpenTarget={go}
            onOpenTicketSheet={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
            onAction={onAction}
          />
        </WorkspaceFrame>
      </PageActionsProvider>
    </HostProvider>
  );
}
