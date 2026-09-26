import type { AgentsState, FileRef, ProjectSummary, Session, TabTarget } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { Bell, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentPanel } from "../agents/AgentPanel";
import { useRunNotifications } from "../agents/use-run-notifications";
import { useProjectGit } from "../code/use-project-git";
import { resolveWorktree } from "../code/use-worktrees";
import { fr } from "../i18n/fr";
import { CommandPalette } from "../palette/CommandPalette";
import type { PaletteAction, PaletteContext } from "../palette/palette-items";
import { navigateTo, useRoute } from "../route";
import { useAgents, useConfig, useNow } from "../state/use-agents";
import { useProject, useProjects } from "../state/use-projects";
import { useSnapshots } from "../state/use-snapshots";
import { TabBar } from "../tabs/TabBar";
import { describeTarget } from "../tabs/tab-title";
import { activeTarget, type TabsAction } from "../tabs/tabs-model";
import { targetToHash } from "../tabs/target-hash";
import { useHashSync } from "../tabs/use-hash-sync";
import { useTabShortcuts } from "../tabs/use-tab-shortcuts";
import { type TabsApi, useTabs } from "../tabs/use-tabs";
import { cycleTheme } from "../theme";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumb, crumbsFor, screenCrumbs } from "./Breadcrumb";
import { ContentView } from "./ContentView";
import { type Host, HostProvider } from "./Host";
import { NotifyButton } from "./NotifyButton";
import { ScreenActions } from "./ScreenActions";
import { ScreenView } from "./ScreenView";
import { type DialogsState, NO_DIALOG, ShellDialogs } from "./ShellDialogs";
import { UserAvatar } from "./UserAvatar";

type Props = { viewer: string; notifications: Session["notifications"] };

export function Shell({ viewer, notifications }: Props) {
  const projects = useProjects();
  const tabs = useTabs();
  const agents = useAgents();
  useRunNotifications(agents, notifications === "browser");
  if (!projects || !tabs) return null;
  return (
    <Workspace
      viewer={viewer}
      notifications={notifications}
      projects={projects}
      tabs={tabs}
      agents={agents}
    />
  );
}

const inTauri = () => "__TAURI_INTERNALS__" in window;
const openWindow = (t: TabTarget) =>
  window.open(`${location.pathname}${targetToHash(t)}`, "_blank", "noopener");

type WorkspaceProps = Props & { projects: ProjectSummary[]; tabs: TabsApi; agents: AgentsState | null };

function Workspace({ viewer, notifications, projects, tabs, agents }: WorkspaceProps) {
  const route = useRoute();
  const screen = route.screen;
  useHashSync(tabs, route.target, screen !== null);
  const active = activeTarget(tabs.state);
  const activeProjectId = active?.projectId ?? null;
  const [lastProjectId, setLastProjectId] = useState<string | null>(activeProjectId);
  const ticketProject = useProject(activeProjectId ?? lastProjectId);
  const project = activeProjectId ? ticketProject : null;
  const snapshots = useSnapshots(projects.map((p) => p.id));
  const config = useConfig();
  const now = useNow();
  const git = useProjectGit(project?.meta.id ?? null, project?.meta.folder ?? null);
  const [palette, setPalette] = useState<{ newTab: boolean } | null>(null);
  const [dialogs, setDialogs] = useState<DialogsState>(NO_DIALOG);
  const [focusRun, setFocusRun] = useState<string | null>(null);
  const editRequests = useRef(new Set<string>());
  const { open } = tabs;

  useEffect(() => {
    if (activeProjectId) setLastProjectId(activeProjectId);
  }, [activeProjectId]);

  const set = useCallback((patch: Partial<DialogsState>) => setDialogs((d) => ({ ...d, ...patch })), []);
  const clearFocus = useCallback(() => setFocusRun(null), []);
  const launch = useCallback(() => set({ assign: { ticketId: null } }), [set]);
  const go = useCallback(
    (target: TabTarget | null, newTab = false) => {
      if (screen && !newTab) navigateTo(target);
      else open(target, { newTab });
    },
    [screen, open],
  );
  const dispatch = (action: TabsAction) => {
    if (screen && (action.type === "activate" || action.type === "activateIndex")) navigateTo(null);
    tabs.dispatch(action);
  };

  const host = useMemo<Host>(
    () => ({
      openTicket: (ticketId) => {
        if (activeProjectId) set({ sheet: { projectId: activeProjectId, ticketId } });
      },
      openNewTicket: (d) => set({ newTicket: d }),
      openAssign: (ticketId) => set({ assign: { ticketId } }),
      openFile: (ref) => set({ preview: ref }),
      openTarget: (target, opts) => go(target, opts?.newTab),
    }),
    [activeProjectId, set, go],
  );

  useTabShortcuts((s) => {
    if (s.kind === "palette") return setPalette({ newTab: false });
    if (s.kind === "newTab") return setPalette({ newTab: true });
    if (s.kind === "activate") return dispatch({ type: "activateIndex", index: s.index });
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
    if (a.kind === "assign") return set({ assign: { ticketId: a.ticketId } });
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
      <div className="flex h-svh flex-col [--tabbar-h:2.5rem]">
        <TabBar
          state={tabs.state}
          describe={(t) => describeTarget(t, { projects, snapshots })}
          isDirty={isDirty}
          dispatch={dispatch}
          onNewTab={() => setPalette({ newTab: true })}
          onOpenWindow={inTauri() ? null : openWindow}
          error={tabs.error}
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
            onOpen={go}
            onSearch={() => setPalette({ newTab: false })}
            onNewProject={() => set({ newProject: true })}
            onNewPage={(parentId) => set({ newPageParent: parentId })}
          />
          <SidebarInset className="min-h-0 min-w-0">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <Breadcrumb
                crumbs={screen ? screenCrumbs(screen) : crumbsFor(active, { project, branch })}
                heading={screen === "agents" || screen === "queue"}
              />
              <span className="flex-1" />
              {git.error && (
                <p role="alert" className="truncate text-xs text-destructive">
                  {git.error}
                </p>
              )}
              <ScreenActions screen={screen} agents={agents} onNewProfile={() => set({ newProfile: true })} />
              {ticketProject && (
                <Button
                  size="sm"
                  className="h-7"
                  title={fr.header.newTicketIn(ticketProject.meta.name)}
                  onClick={() => set({ newTicket: {} })}
                >
                  <Plus />
                  {fr.header.newTicket}
                </Button>
              )}
              {notifications === "browser" ? (
                <NotifyButton />
              ) : (
                <Bell aria-hidden className="size-4 text-muted-foreground" />
              )}
              <UserAvatar user={viewer} />
            </header>
            <div className="min-h-0 flex-1 overflow-auto" data-viewer={viewer}>
              {screen ? (
                <ScreenView
                  screen={screen}
                  projects={projects}
                  agents={agents}
                  config={config}
                  now={now}
                  onAnswer={setFocusRun}
                />
              ) : (
                <ContentView
                  target={active}
                  viewer={viewer}
                  projects={projects}
                  project={project}
                  domains={config?.domains}
                  startEditing={active?.kind === "file" && editRequests.current.has(targetToHash(active))}
                  onNewProject={() => set({ newProject: true })}
                  onNewPage={() => set({ newPageParent: null })}
                  onOpen={(t) => go(t)}
                  onOpenFile={(ref) => set({ preview: ref })}
                  onAssign={(ticketId) => set({ assign: { ticketId } })}
                />
              )}
            </div>
            <AgentPanel onLaunch={launch} focusRunId={focusRun} onFocused={clearFocus} />
          </SidebarInset>
          <ShellDialogs
            state={dialogs}
            set={set}
            viewer={viewer}
            projectsCount={projects.length}
            project={project}
            ticketProject={ticketProject}
            sheetProject={sheetProject}
            agents={agents}
            config={config}
            onOpenTarget={go}
            onOpenFileTab={openFileTab}
          />
          <CommandPalette
            open={palette !== null}
            onOpenChange={(o) => !o && setPalette(null)}
            newTab={palette?.newTab ?? false}
            context={paletteContext}
            onOpenTarget={go}
            onOpenTicketSheet={(projectId, ticketId) => set({ sheet: { projectId, ticketId } })}
            onAction={onAction}
          />
        </SidebarProvider>
      </div>
    </HostProvider>
  );
}
