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
import { fr } from "../i18n/fr";
import { PageBoundary } from "../pages/PageBoundary";
import { PageView } from "../pages/PageView";
import { ProjectHome } from "../pages/ProjectHome";
import { findTicket, targetToHash } from "../tabs/target-hash";
import { FileTabView, TicketTab, Welcome } from "./lazy-screens";
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
  onNewPage(): void;
  onOpen(target: TabTarget | null, newTab?: boolean): void;
  onOpenFile(ref: FileRef): void;
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

const knownTicket = (project: ProjectSnapshot, ref: string): boolean =>
  findTicket(project.tickets, ref) !== undefined;

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
  if (!p.project) return unknownProject(p, t) ? <NotFound what="project" onHome={home} /> : null;
  switch (t.kind) {
    case "project":
      if (p.project.pages.length > 0) return null;
      return <ProjectHome project={p.project} onNewPage={p.onNewPage} />;
    case "page": {
      const page = p.project.pages.find((x) => x.id === t.pageId);
      if (!page) return missing(fr.tabs.missingPage);
      return (
        <PageView
          key={page.id}
          project={p.project}
          page={page}
          viewer={p.project.viewer ?? p.viewer}
          spotlight={t.question ? { kind: "question", id: t.question } : null}
        />
      );
    }
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
    default:
      return null;
  }
}
