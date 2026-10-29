import {
  INBOX_ID,
  type ProjectSnapshot,
  type ProjectSummary,
  type Screen,
  type TabTarget,
  type WorkspaceConfig,
} from "@kibo/schema";
import { withInbox } from "../lib/inbox";
import {
  AppearancePage,
  GeneralPage,
  InboxPage,
  IntegrationsPage,
  MyTicketsPage,
  SecurityPage,
  ShortcutsPage,
  SyncSettingsPage,
  WorkspacePage,
} from "./lazy-screens";

type Props = {
  screen: Screen;
  viewer: string;
  projects: ProjectSummary[];
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  config: WorkspaceConfig | null;
  onOpenTicket(projectId: string, ticketId: string): void;
  onFile(ticketId: string): void;
  onOpen(target: TabTarget): void;
  onShare(projectId: string): void;
  onDeleteProject(projectId: string): void;
  onNewTicket(): void;
};

export function ScreenView(props: Props) {
  const { screen, projects, config, onOpen, onShare, onDeleteProject, onNewTicket, ...p } = props;
  if (screen === "general") return <GeneralPage />;
  if (screen === "integrations") return <IntegrationsPage />;
  if (screen === "appearance") return <AppearancePage />;
  if (screen === "security") return <SecurityPage />;
  if (screen === "sync")
    return (
      <SyncSettingsPage
        viewer={p.viewer}
        projects={projects}
        onOpen={(projectId) => onOpen({ kind: "project", projectId })}
        onShare={onShare}
        onDeleteProject={onDeleteProject}
      />
    );
  if (screen === "shortcuts") return <ShortcutsPage />;
  if (screen === "mine")
    return (
      <MyTicketsPage
        viewer={p.viewer}
        projects={withInbox(projects, p.snapshots)}
        snapshots={p.snapshots}
        onOpenTicket={p.onOpenTicket}
      />
    );
  if (screen === "inbox")
    return (
      <InboxPage
        snapshot={p.snapshots.get(INBOX_ID) ?? null}
        projects={projects}
        viewer={p.viewer}
        onOpenTicket={(ticketId) => p.onOpenTicket(INBOX_ID, ticketId)}
        onNewTicket={onNewTicket}
        onFile={p.onFile}
      />
    );
  if (screen === "workspace") return <WorkspacePage config={config} />;
  return null;
}
