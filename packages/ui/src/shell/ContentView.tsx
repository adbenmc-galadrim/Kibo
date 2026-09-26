import type { Domain, FileRef, ProjectSnapshot, ProjectSummary, TabTarget } from "@kibo/schema";
import { lazy, Suspense } from "react";
import { useChangesSlots } from "../code/agent-slots";
import { fr } from "../i18n/fr";
import { PageView } from "../pages/PageView";
import { ProjectHome } from "../pages/ProjectHome";
import { TicketTab } from "../pages/TicketTab";
import { targetToHash } from "../tabs/target-hash";
import { Overview } from "./Overview";

const ChangesView = lazy(() => import("../code/ChangesView").then((m) => ({ default: m.ChangesView })));
const FileTabView = lazy(() => import("../files/FileTabView").then((m) => ({ default: m.FileTabView })));

type Props = {
  target: TabTarget | null;
  viewer: string;
  projects: ProjectSummary[];
  project: ProjectSnapshot | null;
  domains: Domain[] | undefined;
  startEditing: boolean;
  onNewProject(): void;
  onNewPage(): void;
  onOpen(target: TabTarget): void;
  onOpenFile(ref: FileRef): void;
  onAssign(ticketId: string): void;
};

const missing = (label: string) => <p className="p-8 text-sm text-muted-foreground">{label}</p>;

export function ContentView(p: Props) {
  const t = p.target;
  if (!t) return <Overview viewer={p.viewer} projects={p.projects} onNewProject={p.onNewProject} />;
  if (!p.project) return null;
  switch (t.kind) {
    case "project":
      return <ProjectHome project={p.project} onNewPage={p.onNewPage} />;
    case "page": {
      const page = p.project.pages.find((x) => x.id === t.pageId);
      if (!page) return missing(fr.tabs.missingPage);
      return <PageView key={page.id} project={p.project} page={page} viewer={p.viewer} />;
    }
    case "changes":
      return (
        <Suspense fallback={null}>
          <ChangesView
            project={p.project}
            worktree={t.worktree}
            onWorktreeChange={(worktree) => p.onOpen({ ...t, worktree })}
            onOpenFile={p.onOpenFile}
            useSlots={useChangesSlots}
          />
        </Suspense>
      );
    case "file":
      return (
        <Suspense fallback={null}>
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
        </Suspense>
      );
    case "ticket":
      return (
        <TicketTab
          project={p.project}
          ticketId={t.ticketId}
          domains={p.domains}
          onAssign={p.onAssign}
          onOpenFile={p.onOpenFile}
        />
      );
  }
}
