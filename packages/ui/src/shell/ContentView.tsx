import type { Domain, FileRef, ProjectSnapshot, ProjectSummary, TabTarget } from "@kibo/schema";
import { useChangesSlots } from "../code/agent-slots";
import { fr } from "../i18n/fr";
import { PageView } from "../pages/PageView";
import { ProjectHome } from "../pages/ProjectHome";
import { targetToHash } from "../tabs/target-hash";
import { ChangesView, FileTabView, TicketTab, Welcome } from "./lazy-screens";
import { Overview } from "./Overview";

type Props = {
  target: TabTarget | null;
  viewer: string;
  projects: ProjectSummary[];
  inboxCount: number;
  project: ProjectSnapshot | null;
  domains: Domain[] | undefined;
  startEditing: boolean;
  onNewProject(): void;
  onImportProject(): void;
  onTutorial(): void;
  onNewPage(): void;
  onSuggestPages(projectId: string): void;
  onOpen(target: TabTarget, newTab?: boolean): void;
  onOpenFile(ref: FileRef): void;
  onAssign(ticketId: string): void;
  onOpenTicket(projectId: string, ticketId: string): void;
};

const missing = (label: string) => <p className="p-8 text-sm text-muted-foreground">{label}</p>;

export function ContentView(p: Props) {
  const t = p.target;
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
        inboxCount={p.inboxCount}
        onNewProject={p.onNewProject}
        onOpenInbox={() => p.onOpen({ kind: "screen", screen: "inbox" })}
      />
    );
  if (!p.project) return null;
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
      return <PageView key={page.id} project={p.project} page={page} viewer={p.project.viewer ?? p.viewer} />;
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
  }
}
