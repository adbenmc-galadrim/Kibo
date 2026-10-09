import { type AgentsState, iconUrl, type ProjectSummary, type TabTarget } from "@kibo/schema";
import { SidebarInset, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentPanel } from "../agents/AgentPanel";
import { useProjectGit } from "../code/use-project-git";
import { resolveWorktree } from "../code/use-worktrees";
import { useDesktopIntegration } from "../desktop/use-desktop-integration";
import { useWindowTitle } from "../desktop/use-window-title";
import { projectDomainsOf } from "../lib/project-domains";
import type { PaletteContext } from "../palette/palette-items";
import { useRoute } from "../route";
import { canEdit } from "../state/access";
import { useConfig, useNow } from "../state/use-agents";
import { useProject } from "../state/use-projects";
import { useDestructiveKeyGuard } from "../tabs/key-guard";
import { TabBar } from "../tabs/TabBar";
import { describeTarget } from "../tabs/tab-title";
import { activeTarget } from "../tabs/tabs-model";
import { targetToHash } from "../tabs/target-hash";
import { useHashSync } from "../tabs/use-hash-sync";
import { useKeepOnEdit } from "../tabs/use-keep-on-edit";
import { useTabShortcuts } from "../tabs/use-tab-shortcuts";
import type { TabsApi } from "../tabs/use-tabs";
import { cycleTheme } from "../theme";
import { AgentsShellProvider } from "./AgentsShellProvider";
import { AppSidebar } from "./AppSidebar";
import { ContentView } from "./ContentView";
import { type Host, HostProvider } from "./Host";
import { helpPatch } from "./help-dialogs";
import { CommandPalette, TutorialSlot } from "./lazy-dialogs";
import { ProjectAgentPanel, ProjectPresence, ProjectStatusBanner } from "./lazy-screens";
import { PageActionsProvider } from "./page-actions";
import { ScreenView } from "./ScreenView";
import type { ShellProps } from "./Shell";
import { ShellDialogs } from "./ShellDialogs";
import { ShellHeader } from "./ShellHeader";
import { fileTabOpener, paletteActionHandler } from "./shell-actions";
import { useAppHelp } from "./use-app-help";
import { useOpenView, useSnapshotLookup } from "./use-open-view";
import { useOpened } from "./use-opened";
import { useProjectAgentPanel } from "./use-project-agent-panel";
import { anyDialogOpen, useShellDialogs } from "./use-shell-dialogs";
import { useWorkspaceSnapshots } from "./use-workspace-snapshots";
import { inTauri, openWindow } from "./workspace-actions";

type WorkspaceProps = ShellProps & { projects: ProjectSummary[]; tabs: TabsApi; agents: AgentsState | null };

export function Workspace({ viewer, notifications, projects, tabs, agents }: WorkspaceProps) {
  const route = useRoute();
  useHashSync(tabs, route.target);
  const active = activeTarget(tabs.state);
  const screen = active?.kind === "screen" ? active.screen : null;
  const activeProjectId = active && active.kind !== "screen" ? active.projectId : null;
  const [lastProjectId, setLastProjectId] = useState<string | null>(activeProjectId);
  const ticketProject = useProject(activeProjectId ?? lastProjectId);
  const project = activeProjectId ? ticketProject : null;
  const { snapshots, mineCount, inboxCount } = useWorkspaceSnapshots(projects, viewer);
  const config = useConfig();
  const now = useNow();
  const git = useProjectGit(project?.meta.id ?? null, project?.meta.folder ?? null);
  const { dialogs, set, focusRun, setFocusRun, clearFocus, palette, setPalette } = useShellDialogs();
  const paletteOpened = useOpened(palette !== null);
  const agentPanel = useProjectAgentPanel(project);
  useAppHelp(set);
  const editRequests = useRef(new Set<string>());
  const projectRef = useRef(project);
  const { open } = tabs;

  useWindowTitle(active ? describeTarget(active, { projects, snapshots }).title : null);
  useDesktopIntegration();
  useEffect(() => {
    if (activeProjectId) setLastProjectId(activeProjectId);
  }, [activeProjectId]);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const launch = useCallback(() => set({ assign: { projectId: null, ticketId: null } }), [set]);
  const go = useCallback(
    (target: TabTarget | null, newTab = false, keep?: boolean) =>
      open(target, keep === undefined ? { newTab } : { newTab, keep }),
    [open],
  );
  const currentProject = useCallback(() => projectRef.current, []);
  const closeProject = (projectId: string) => {
    tabs.dispatch({ type: "closeProject", projectId });
    setLastProjectId((id) => (id === projectId ? null : id));
    go(null);
  };
  const views = useOpenView(currentProject, go, useSnapshotLookup(snapshots));

  const host = useMemo<Host>(
    () => ({
      openTicket: (ticketId) => {
        if (activeProjectId) set({ sheet: { projectId: activeProjectId, ticketId } });
      },
      openNewTicket: (d) => {
        if (projectRef.current && !canEdit(projectRef.current)) return;
        set({ newTicket: activeProjectId ? { ...d, projectId: activeProjectId } : d });
      },
      openAssign: (ticketId) => set({ assign: { projectId: null, ticketId } }),
      openFile: (ref) => set({ preview: ref }),
      openTarget: (target, opts) => go(target, opts?.newTab, opts?.keep),
      openView: views.openView,
    }),
    [activeProjectId, set, go, views.openView],
  );

  useDestructiveKeyGuard();
  useKeepOnEdit(tabs, anyDialogOpen(dialogs, palette));
  useTabShortcuts((s) => {
    if (s.kind === "palette") return setPalette({ newTab: false });
    if (s.kind === "newTab") return setPalette({ newTab: true });
    if (s.kind === "activate") return tabs.dispatch({ type: "activateIndex", index: s.index });
    if (s.kind === "reopen") return tabs.reopen();
    if (s.kind === "help") return set(helpPatch("shortcutsHelp"));
    if (s.kind === "projectAgent") return agentPanel.toggle();
    const id = tabs.state.activeId;
    if (!id) return;
    if (s.kind === "close") tabs.dispatch({ type: "close", id });
    if (s.kind === "togglePin")
      tabs.dispatch({ type: "pin", id, pinned: !tabs.state.tabs.find((t) => t.id === id)?.pinned });
  });

  const onAction = paletteActionHandler({ set, setFocusRun, go, activeProjectId, cycleTheme });
  const openFileTab = fileTabOpener({ editRequests: editRequests.current, set, go });

  const branch =
    active?.kind === "changes" ? (resolveWorktree(git.worktrees, active.worktree)?.branch ?? null) : null;
  const isDirty = (t: TabTarget) =>
    t.kind === "changes" &&
    t.projectId === project?.meta.id &&
    (t.worktree === null || t.worktree === git.main?.path) &&
    (git.changesCount ?? 0) > 0;
  const sheetProjectId = dialogs.sheet?.projectId ?? null;
  const sheetProject =
    sheetProjectId === project?.meta.id
      ? project
      : sheetProjectId
        ? (snapshots.get(sheetProjectId) ?? null)
        : null;
  const recents = tabs.state.recents;
  const activeTicketId = active?.kind === "ticket" ? active.ticketId : (dialogs.sheet?.ticketId ?? null);
  const paletteContext = useMemo<PaletteContext>(
    () => ({ projects, snapshots, recents, activeProjectId, activeTicketId, agents }),
    [projects, snapshots, recents, activeProjectId, activeTicketId, agents],
  );

  return (
    <HostProvider host={host}>
      <AgentsShellProvider agents={agents} openView={views.openView}>
        <PageActionsProvider>
          <div className="flex h-svh flex-col [--tabbar-h:2.5rem]">
            <TabBar
              state={tabs.state}
              describe={(t) => describeTarget(t, { projects, snapshots })}
              isDirty={isDirty}
              dispatch={tabs.dispatch}
              onNewTab={() => setPalette({ newTab: true })}
              onOpenWindow={inTauri() ? null : openWindow}
              error={tabs.error}
              trailing={
                project?.sync.shared && (
                  <ProjectPresence project={project} active={active} sheet={dialogs.sheet} />
                )
              }
            />
            <SidebarProvider className="min-h-0 flex-1">
              <AppSidebar
                className="top-(--tabbar-h) h-[calc(100svh-var(--tabbar-h))]!"
                projects={projects}
                active={project}
                activeTarget={active}
                screen={screen}
                agents={agents}
                changesCount={git.worktrees ? git.changesCount : null}
                mineCount={mineCount}
                inboxCount={inboxCount}
                workspaceName={config?.workspaceName ?? null}
                workspaceIcon={
                  config?.workspaceIcon ? iconUrl({ kind: "workspace" }, config.workspaceIcon) : null
                }
                onOpen={go}
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
              <SidebarInset className="min-h-0 min-w-0">
                <ShellHeader
                  active={active}
                  screen={screen}
                  project={project}
                  ticketProject={ticketProject}
                  branch={branch}
                  gitError={git.error}
                  agents={agents}
                  agentPanel={agentPanel}
                  viewer={viewer}
                  notifications={notifications}
                  now={now}
                  onNewProfile={() => set({ newProfile: true })}
                  onNewTicket={() => set({ newTicket: {} })}
                  onShare={() => project && set({ share: project.meta.id })}
                  onOpenRun={setFocusRun}
                  onOpen={(t, keep) => go(t, false, keep)}
                  onHelp={(key) => set(helpPatch(key))}
                />
                {project?.sync.shared && (
                  <ProjectStatusBanner projectId={project.meta.id} access={project.sync.access} />
                )}
                <div className="min-h-0 flex-1 overflow-auto" data-viewer={viewer}>
                  {screen ? (
                    <ScreenView
                      screen={screen}
                      viewer={viewer}
                      projects={projects}
                      snapshots={snapshots}
                      agents={agents}
                      config={config}
                      now={now}
                      onAnswer={setFocusRun}
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
                      onAssign={(ticketId) => set({ assign: { projectId: null, ticketId } })}
                      onOpenTicket={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
                    />
                  )}
                </div>
                <AgentPanel
                  onLaunch={launch}
                  focusRunId={focusRun}
                  onFocused={clearFocus}
                  onOpenFile={(ref) => set({ preview: ref })}
                />
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
              <TutorialSlot
                projects={projects}
                snapshots={snapshots}
                activeTarget={active}
                onOpen={(t) => go(t)}
                onDeleteDemo={(projectId) => set({ deleteProject: projectId })}
              />
              {views.dialog}
              {paletteOpened && (
                <CommandPalette
                  open={palette !== null}
                  onOpenChange={(o) => !o && setPalette(null)}
                  newTab={palette?.newTab ?? false}
                  context={paletteContext}
                  onOpenTarget={go}
                  onOpenTicketSheet={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
                  onAction={onAction}
                />
              )}
            </SidebarProvider>
          </div>
        </PageActionsProvider>
      </AgentsShellProvider>
    </HostProvider>
  );
}
