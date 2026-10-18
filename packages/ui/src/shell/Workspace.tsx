import {
  type AgentsState,
  iconUrl,
  type ProjectSummary,
  type TabTarget,
  targetProjectId,
} from "@kibo/schema";
import { SidebarInset } from "@kibo/sdk/ui/sidebar";
import { useCallback, useRef } from "react";
import { useRunNotifications } from "../agents/use-run-notifications";
import { useProjectGit } from "../code/use-project-git";
import { useDesktopIntegration } from "../desktop/use-desktop-integration";
import { useWindowTitle } from "../desktop/use-window-title";
import { projectDomainsOf } from "../lib/project-domains";
import { useRoute } from "../route";
import { useConfig, useNow } from "../state/use-agents";
import { describeTarget } from "../tabs/tab-title";
import { activeTarget } from "../tabs/tabs-model";
import { targetToHash } from "../tabs/target-hash";
import { useHashSync } from "../tabs/use-hash-sync";
import type { TabsApi } from "../tabs/use-tabs";
import { cycleTheme } from "../theme";
import { AgentsShellProvider } from "./AgentsShellProvider";
import { AppSidebar } from "./AppSidebar";
import { ContentView } from "./ContentView";
import { HostProvider } from "./Host";
import { helpPatch } from "./help-dialogs";
import { TutorialSlot } from "./lazy-dialogs";
import {
  AgentPanel,
  ProjectAgentPanel,
  ProjectPresence,
  ProjectStatusBanner,
  RunSidePanel,
} from "./lazy-screens";
import { ExecutionGate } from "./nav/ExecutionGate";
import { RetiredRedirect } from "./nav/lazy-nav";
import { WorkspaceFrame } from "./nav/WorkspaceFrame";
import { PageActionsProvider } from "./page-actions";
import { ScreenView } from "./ScreenView";
import type { ShellProps } from "./Shell";
import { ShellDialogs } from "./ShellDialogs";
import { ShellHeader } from "./ShellHeader";
import { fileTabOpener, paletteActionHandler } from "./shell-actions";
import { useAppHelp } from "./use-app-help";
import { useOpenView, useSnapshotLookup } from "./use-open-view";
import { useProjectAgentPanel } from "./use-project-agent-panel";
import { useProjectFocus } from "./use-project-focus";
import { useProjectLanding } from "./use-project-landing";
import { useRunPanel } from "./use-run-panel";
import { useScreenVisit } from "./use-screen-visit";
import { useShellDialogs } from "./use-shell-dialogs";
import { useWorkspaceHost } from "./use-workspace-host";
import { useWorkspaceSnapshots } from "./use-workspace-snapshots";
import { useWorkspaceTabs } from "./use-workspace-tabs";
import { useWorkspaceView } from "./use-workspace-view";
import { WorkspacePalette } from "./WorkspacePalette";

type WorkspaceProps = ShellProps & { projects: ProjectSummary[]; tabs: TabsApi; agents: AgentsState | null };

export function Workspace({ viewer, notifications, projects, tabs, agents }: WorkspaceProps) {
  const route = useRoute();
  useHashSync(tabs, route.target);
  const active = activeTarget(tabs.state);
  const screen = active?.kind === "screen" ? active.screen : null;
  const activeProjectId = active ? targetProjectId(active) : null;
  const { ticketProject, project, projectRef, currentProject, forget } = useProjectFocus(activeProjectId);
  useProjectLanding(tabs, project);
  const { snapshots, mineCount, inboxCount } = useWorkspaceSnapshots(projects, viewer);
  const config = useConfig();
  const now = useNow();
  const git = useProjectGit(ticketProject?.meta.id ?? null, ticketProject?.meta.folder ?? null);
  const shell = useShellDialogs();
  const { dialogs, set, focusRun, setFocusRun, clearFocus, palette, setPalette } = shell;
  const agentPanel = useProjectAgentPanel(project);
  const runPanel = useRunPanel(activeProjectId, agentPanel);
  useRunNotifications(agents, notifications === "browser", runPanel.open);
  useAppHelp(set);
  const editRequests = useRef(new Set<string>());
  const { open } = tabs;

  const describe = (t: TabTarget) => describeTarget(t, { projects, snapshots, runs: agents?.runs });
  useWindowTitle(active ? describe(active).title : null);
  useDesktopIntegration();

  const launch = useCallback(() => set({ assign: { projectId: null, ticketId: null } }), [set]);
  const go = useCallback(
    (target: TabTarget | null, newTab = false, keep?: boolean) =>
      open(target, keep === undefined ? { newTab } : { newTab, keep }),
    [open],
  );
  const goHome = useCallback(() => go(null), [go]);
  const closeProject = (projectId: string) => {
    tabs.dispatch({ type: "closeProject", projectId });
    forget(projectId);
    go(null);
  };
  const views = useOpenView(currentProject, go, useSnapshotLookup(snapshots));
  const screenVisit = useScreenVisit(screen, go);

  const host = useWorkspaceHost({
    activeProjectId,
    projectRef,
    set,
    go,
    openView: views.openView,
    openRun: runPanel.open,
    answerRun: setFocusRun,
    showProjectAgent: agentPanel.show,
  });

  const shownTabs = useWorkspaceTabs(tabs, shell, agentPanel.toggle);

  const onAction = paletteActionHandler({ set, setFocusRun, go, activeProjectId, cycleTheme });
  const openFileTab = fileTabOpener({ editRequests: editRequests.current, set, go });

  const { branch, isDirty, sheetProject, paletteContext } = useWorkspaceView({
    active,
    project,
    ticketProject,
    git,
    dialogs,
    projects,
    snapshots,
    recents: tabs.state.recents,
    activeProjectId,
    agents,
  });

  return (
    <HostProvider host={host}>
      <AgentsShellProvider agents={agents} openView={views.openView}>
        <PageActionsProvider>
          <WorkspaceFrame
            tabs={shownTabs}
            describe={describe}
            isDirty={isDirty}
            onNewTab={() => setPalette({ newTab: true })}
            presence={(place) =>
              project?.sync.shared && (
                <ProjectPresence project={project} active={active} sheet={dialogs.sheet} avatars={place} />
              )
            }
            pageShowsPresence={active?.kind === "page"}
          >
            <AppSidebar
              className="top-(--tabbar-h) h-[calc(100svh-var(--tabbar-h))]!"
              projects={projects}
              active={project}
              activeTarget={active}
              screen={screen}
              mineCount={mineCount}
              inboxCount={inboxCount}
              workspaceName={config?.workspaceName ?? null}
              workspaceIcon={
                config?.workspaceIcon ? iconUrl({ kind: "workspace" }, config.workspaceIcon) : null
              }
              viewer={viewer}
              onHelp={(key) => set(helpPatch(key))}
              onOpen={screenVisit.open}
              onSearch={() => setPalette({ newTab: false })}
              onNewProject={() => set({ newProject: true })}
              onNewPage={(parentId) => set({ newPageParent: parentId })}
              onRenamePage={(page) => set({ renamePage: page })}
              onDeletePage={(page) => set({ deletePage: page })}
              onShare={(projectId) => set({ share: projectId })}
              onEditProject={(projectId) => set({ editProject: projectId })}
              onDeleteProject={(projectId) => set({ deleteProject: projectId })}
              onJoin={() => set({ join: true })}
            />
            <SidebarInset className="min-h-0 min-w-0 mr-(--project-agent-w)">
              <ShellHeader
                active={active}
                screen={screen}
                project={project}
                branch={branch}
                gitError={project ? git.error : null}
                agents={agents}
                agentPanel={agentPanel}
                notifications={notifications}
                now={now}
                onNewAgent={() => set({ newAgent: true })}
                onNewSkill={() => set({ newSkill: true })}
                onOpenRun={setFocusRun}
                onOpen={(t, keep) => go(t, false, keep)}
              />
              {project?.sync.shared && (
                <ProjectStatusBanner projectId={project.meta.id} access={project.sync.access} />
              )}
              <RetiredRedirect target={active} onHome={goHome} />
              <div className="min-h-0 flex-1 overflow-auto" data-viewer={viewer}>
                {screen ? (
                  <ScreenView
                    key={`${screen}-${screenVisit.visit}`}
                    screen={screen}
                    viewer={viewer}
                    projects={projects}
                    snapshots={snapshots}
                    config={config}
                    onOpenTicket={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
                    onAssign={(projectId, ticketId) => set({ assign: { projectId, ticketId } })}
                    onFile={(ticketId) => set({ fileTicket: { ticketId } })}
                    onOpen={(t) => go(t)}
                    onShare={(projectId) => set({ share: projectId })}
                    onDeleteProject={(projectId) => set({ deleteProject: projectId })}
                    onNewTicket={() => set({ newTicket: {} })}
                  />
                ) : (
                  <ContentView
                    target={active}
                    viewer={viewer}
                    projects={projects}
                    snapshots={snapshots}
                    inboxCount={inboxCount}
                    project={project}
                    domains={projectDomainsOf(project, config)}
                    startEditing={active?.kind === "file" && editRequests.current.has(targetToHash(active))}
                    onNewProject={() => set({ newProject: true })}
                    onImportProject={() => set({ newProject: true, newProjectFocus: "folder" })}
                    onTutorial={() => set({ tutorial: true })}
                    onNewPage={() => set({ newPageParent: null })}
                    onSuggestPages={(projectId) => set({ suggestFor: projectId })}
                    onOpen={(t, newTab) => go(t, newTab)}
                    onOpenFile={(ref) => set({ preview: ref })}
                    onOpenTicket={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
                  />
                )}
              </div>
              <ExecutionGate>
                <AgentPanel
                  onLaunch={launch}
                  focusRunId={focusRun}
                  onFocused={clearFocus}
                  onOpenFile={(ref) => set({ preview: ref })}
                />
              </ExecutionGate>
            </SidebarInset>
            {agentPanel.opened && project && (
              <ProjectAgentPanel
                key={project.meta.id}
                open={agentPanel.open}
                project={project}
                tab={agentPanel.tab}
                onTab={agentPanel.setTab}
                onClose={agentPanel.close}
              />
            )}
            {runPanel.runId && (
              <RunSidePanel
                runId={runPanel.runId}
                onClose={runPanel.close}
                onOpenTicket={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
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
            <TutorialSlot
              projects={projects}
              snapshots={snapshots}
              activeTarget={active}
              onOpen={(t) => go(t)}
              onDeleteDemo={(projectId) => set({ deleteProject: projectId })}
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
      </AgentsShellProvider>
    </HostProvider>
  );
}
