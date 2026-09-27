import type { AgentsState, FileRef, ProjectSummary, Session, TabTarget } from "@kibo/schema";
import { SidebarInset, SidebarProvider } from "@kibo/sdk/ui/sidebar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentPanel } from "../agents/AgentPanel";
import { useRunNotifications } from "../agents/use-run-notifications";
import { useProjectGit } from "../code/use-project-git";
import { resolveWorktree } from "../code/use-worktrees";
import { projectDomainsOf } from "../lib/project-domains";
import { countMine, myTickets } from "../mine/my-tickets";
import type { PaletteAction, PaletteContext } from "../palette/palette-items";
import { useRoute } from "../route";
import { canEdit } from "../state/access";
import { useAgents, useConfig, useNow } from "../state/use-agents";
import { useProject, useProjects } from "../state/use-projects";
import { useSnapshots } from "../state/use-snapshots";
import { TabBar } from "../tabs/TabBar";
import { describeTarget } from "../tabs/tab-title";
import { activeTarget } from "../tabs/tabs-model";
import { targetToHash } from "../tabs/target-hash";
import { useHashSync } from "../tabs/use-hash-sync";
import { useTabShortcuts } from "../tabs/use-tab-shortcuts";
import { type TabsApi, useTabs } from "../tabs/use-tabs";
import { cycleTheme } from "../theme";
import { AppSidebar } from "./AppSidebar";
import { ContentView } from "./ContentView";
import { type Host, HostProvider } from "./Host";
import { CommandPalette } from "./lazy-dialogs";
import { IntegrationNotices, ProjectPresence, ProjectStatusBanner } from "./lazy-screens";
import { PageActionsProvider } from "./page-actions";
import { ScreenView } from "./ScreenView";
import { type DialogsState, NO_DIALOG, ShellDialogs } from "./ShellDialogs";
import { ShellHeader } from "./ShellHeader";
import { useOpenView } from "./use-open-view";
import { useOpened } from "./use-opened";
import { useUpdateSchedule } from "./use-update-schedule";
import { inTauri, openWindow, renameWorkspace } from "./workspace-actions";

type Props = { viewer: string; notifications: Session["notifications"] };

export function Shell({ viewer, notifications }: Props) {
  const projects = useProjects();
  const tabs = useTabs();
  const agents = useAgents();
  useRunNotifications(agents, notifications === "browser");
  useUpdateSchedule();
  if (!projects || !tabs) return null;
  return (
    <>
      <Workspace
        viewer={viewer}
        notifications={notifications}
        projects={projects}
        tabs={tabs}
        agents={agents}
      />
      <IntegrationNotices notifications={notifications} />
    </>
  );
}

type WorkspaceProps = Props & { projects: ProjectSummary[]; tabs: TabsApi; agents: AgentsState | null };

function Workspace({ viewer, notifications, projects, tabs, agents }: WorkspaceProps) {
  const route = useRoute();
  useHashSync(tabs, route.target);
  const active = activeTarget(tabs.state);
  const screen = active?.kind === "screen" ? active.screen : null;
  const activeProjectId = active && active.kind !== "screen" ? active.projectId : null;
  const [lastProjectId, setLastProjectId] = useState<string | null>(activeProjectId);
  const ticketProject = useProject(activeProjectId ?? lastProjectId);
  const project = activeProjectId ? ticketProject : null;
  const snapshots = useSnapshots(projects.map((p) => p.id));
  const mineCount = useMemo(
    () => countMine(myTickets(projects, snapshots, viewer, "assigned")),
    [projects, snapshots, viewer],
  );
  const config = useConfig();
  const now = useNow();
  const git = useProjectGit(project?.meta.id ?? null, project?.meta.folder ?? null);
  const [palette, setPalette] = useState<{ newTab: boolean } | null>(null);
  const paletteOpened = useOpened(palette !== null);
  const [dialogs, setDialogs] = useState<DialogsState>(NO_DIALOG);
  const [focusRun, setFocusRun] = useState<string | null>(null);
  const editRequests = useRef(new Set<string>());
  const projectRef = useRef(project);
  const { open } = tabs;

  useEffect(() => {
    if (activeProjectId) setLastProjectId(activeProjectId);
  }, [activeProjectId]);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const set = useCallback((patch: Partial<DialogsState>) => setDialogs((d) => ({ ...d, ...patch })), []);
  const clearFocus = useCallback(() => setFocusRun(null), []);
  const launch = useCallback(() => set({ assign: { projectId: null, ticketId: null } }), [set]);
  const go = useCallback((target: TabTarget | null, newTab = false) => open(target, { newTab }), [open]);
  const currentProject = useCallback(() => projectRef.current, []);
  const views = useOpenView(currentProject, go);

  const host = useMemo<Host>(
    () => ({
      openTicket: (ticketId) => {
        if (activeProjectId) set({ sheet: { projectId: activeProjectId, ticketId } });
      },
      openNewTicket: (d) => {
        if (!projectRef.current || canEdit(projectRef.current)) set({ newTicket: d });
      },
      openAssign: (ticketId) => set({ assign: { projectId: null, ticketId } }),
      openFile: (ref) => set({ preview: ref }),
      openTarget: (target, opts) => go(target, opts?.newTab),
      openView: views.openView,
    }),
    [activeProjectId, set, go, views.openView],
  );

  useTabShortcuts((s) => {
    if (s.kind === "palette") return setPalette({ newTab: false });
    if (s.kind === "newTab") return setPalette({ newTab: true });
    if (s.kind === "activate") return tabs.dispatch({ type: "activateIndex", index: s.index });
    const id = tabs.state.activeId;
    if (!id) return;
    if (s.kind === "close") tabs.dispatch({ type: "close", id });
    if (s.kind === "togglePin")
      tabs.dispatch({ type: "pin", id, pinned: !tabs.state.tabs.find((t) => t.id === id)?.pinned });
  });

  const onAction = (a: PaletteAction) => {
    if (a.kind === "newProject") return set({ newProject: true });
    if (a.kind === "toggleTheme") return void cycleTheme();
    if (a.kind === "reply") return setFocusRun(a.runId);
    if (a.kind === "assign") return set({ assign: { projectId: null, ticketId: a.ticketId } });
    if (a.projectId !== activeProjectId) go({ kind: "project", projectId: a.projectId });
    if (a.kind === "newPage") set({ newPageParent: null });
    if (a.kind === "newTicket") set({ newTicket: { parentId: a.parentId } });
  };
  const openFileTab = (ref: FileRef, edit: boolean) => {
    const target: TabTarget = {
      kind: "file",
      projectId: ref.projectId,
      worktree: ref.worktree,
      path: ref.path,
      line: ref.line,
    };
    if (edit) editRequests.current.add(targetToHash(target));
    set({ preview: null });
    go(target, true);
  };

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
              workspaceName={config?.workspaceName ?? null}
              onRenameWorkspace={renameWorkspace}
              onOpen={go}
              onSearch={() => setPalette({ newTab: false })}
              onNewProject={() => set({ newProject: true })}
              onNewPage={(parentId) => set({ newPageParent: parentId })}
              onShare={(projectId) => set({ share: projectId })}
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
                viewer={viewer}
                notifications={notifications}
                onNewProfile={() => set({ newProfile: true })}
                onNewTicket={() => set({ newTicket: {} })}
                onShare={() => project && set({ share: project.meta.id })}
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
                  />
                ) : (
                  <ContentView
                    target={active}
                    viewer={viewer}
                    projects={projects}
                    project={project}
                    domains={projectDomainsOf(project, config)}
                    startEditing={active?.kind === "file" && editRequests.current.has(targetToHash(active))}
                    onNewProject={() => set({ newProject: true })}
                    onImportProject={() => set({ newProject: true, newProjectFocus: "folder" })}
                    onNewPage={() => set({ newPageParent: null })}
                    onSuggestPages={(projectId) => set({ suggestFor: projectId })}
                    onOpen={(t) => go(t)}
                    onOpenFile={(ref) => set({ preview: ref })}
                    onAssign={(ticketId) => set({ assign: { projectId: null, ticketId } })}
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
            <ShellDialogs
              state={dialogs}
              set={set}
              viewer={viewer}
              projectsCount={projects.length}
              project={project}
              ticketProject={ticketProject}
              sheetProject={sheetProject}
              snapshots={snapshots}
              agents={agents}
              config={config}
              onOpenTarget={go}
              onOpenFileTab={openFileTab}
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
    </HostProvider>
  );
}
