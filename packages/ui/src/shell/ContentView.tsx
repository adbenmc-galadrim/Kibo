import {
  type Domain,
  type FileRef,
  isInbox,
  type ProjectSnapshot,
  type ProjectSummary,
  type TabTarget,
  targetProjectId,
} from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import type { ReactNode } from "react";
import { useChangesSlots } from "../code/agent-slots";
import { fr } from "../i18n/fr";
import { PageBoundary } from "../pages/PageBoundary";
import { PageView } from "../pages/PageView";
import { ProjectHome } from "../pages/ProjectHome";
import { targetToHash } from "../tabs/target-hash";
import {
  ChangesView,
  FileTabView,
  HiddenScreenNotice,
  RunPage,
  SkillsPage,
  TicketTab,
  Welcome,
} from "./lazy-screens";
import { ExecutionGate } from "./nav/ExecutionGate";
import { Overview } from "./Overview";

type Props = {
  target: TabTarget | null;
  viewer: string;
  projects: ProjectSummary[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  inboxCount: number;
  project: ProjectSnapshot | null;
  domains: Domain[] | undefined;
  startEditing: boolean;
  onNewProject(): void;
  onImportProject(): void;
  onTutorial(): void;
  onNewPage(): void;
  onSuggestPages(projectId: string): void;
  onOpen(target: TabTarget | null, newTab?: boolean): void;
  onOpenFile(ref: FileRef): void;
  onAssign(ticketId: string): void;
  onOpenTicket(projectId: string, ticketId: string): void;
};

const SprintTab = lazyPanel(() => import("./sprint/SprintTab").then((m) => m.SprintTab), fr.lazy);

const NotFound = lazyPanel(() => import("./NotFound").then((m) => m.NotFound), fr.lazy, {
  fallback: "sr-only",
});

const missing = (label: string) => <p className="p-8 text-sm text-muted-foreground">{label}</p>;

const unknownProject = (p: Props, target: TabTarget): boolean => {
  const id = targetProjectId(target);
  return id !== null && !isInbox(id) && !p.projects.some((project) => project.id === id);
};

const knownTicket = (project: ProjectSnapshot, ticketId: string): boolean =>
  project.tickets.some((t) => t.id === ticketId || t.key === ticketId);

export function ContentView(p: Props) {
  return <PageBoundary resetKey={targetToHash(p.target)}>{content(p)}</PageBoundary>;
}

function content(p: Props): ReactNode {
  const t = p.target;
  const home = () => p.onOpen(null);
  if (!t && p.projects.length === 0)
    return (
      <Welcome
        onCreate={p.onNewProject}
        onImport={p.onImportProject}
        onTutorial={p.onTutorial}
        onConnectGithub={() => p.onOpen({ kind: "screen", screen: "integrations" })}
      />
    );
  if (!t)
    return (
      <Overview
        viewer={p.viewer}
        projects={p.projects}
        snapshots={p.snapshots}
        inboxCount={p.inboxCount}
        onNewProject={p.onNewProject}
        onOpenInbox={() => p.onOpen({ kind: "screen", screen: "inbox" })}
      />
    );
  if (t.kind === "run" || t.kind === "skill")
    return (
      <ExecutionGate fallback={<HiddenScreenNotice onHome={home} />}>
        {t.kind === "run" ? (
          <RunPage key={t.runId} runId={t.runId} />
        ) : (
          <SkillsPage key={t.skillId} projects={p.projects} initialSkill={t.skillId} />
        )}
      </ExecutionGate>
    );
  if (!p.project) return unknownProject(p, t) ? <NotFound what="project" onHome={home} /> : null;
  switch (t.kind) {
    case "project":
      if (p.project.pages.length > 0) return null;
      return (
        <ProjectHome
          project={p.project}
          onNewPage={p.onNewPage}
          onSuggest={() => p.onSuggestPages(t.projectId)}
        />
      );
    case "page": {
      const page = p.project.pages.find((x) => x.id === t.pageId);
      if (!page) return missing(fr.tabs.missingPage);
      return (
        <PageView
          key={page.id}
          project={p.project}
          page={page}
          viewer={p.project.viewer ?? p.viewer}
          question={t.question ?? null}
        />
      );
    }
    case "changes":
      return (
        <ChangesView
          project={p.project}
          worktree={t.worktree}
          onWorktreeChange={(worktree) => p.onOpen({ ...t, worktree })}
          onOpenFile={p.onOpenFile}
          onOpenInTab={(ref) =>
            p.onOpen(
              {
                kind: "file",
                projectId: ref.projectId,
                worktree: ref.worktree,
                path: ref.path,
                line: ref.line,
              },
              true,
            )
          }
          useSlots={useChangesSlots}
        />
      );
    case "file":
      return (
        <FileTabView
          key={targetToHash(t)}
          fileRef={{
            projectId: t.projectId,
            worktree: t.worktree,
            path: t.path,
            line: t.line,
            origin: null,
          }}
          startEditing={p.startEditing}
        />
      );
    case "ticket":
      if (!knownTicket(p.project, t.ticketId)) return <NotFound what="ticket" onHome={home} />;
      return (
        <TicketTab
          project={p.project}
          ticketId={t.ticketId}
          domains={p.domains}
          viewer={p.project.viewer ?? p.viewer}
          onAssign={p.onAssign}
          onOpenFile={p.onOpenFile}
          onOpenTicket={(ticketId) => p.onOpenTicket(t.projectId, ticketId)}
        />
      );
    case "sprint":
      return (
        <SprintTab
          key={t.sprintId}
          project={p.project}
          sprintId={t.sprintId}
          onOpenTicket={(ticketId) => p.onOpenTicket(t.projectId, ticketId)}
        />
      );
  }
}
