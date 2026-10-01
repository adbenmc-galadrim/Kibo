import {
  type AgentsState,
  INBOX_ID,
  type ProjectSnapshot,
  type ProjectSummary,
  type Screen,
  type TabTarget,
  type WorkspaceConfig,
} from "@kibo/schema";
import { withInbox } from "../lib/inbox";
import {
  AgentsPage,
  AppearancePage,
  ComponentSourcesPage,
  ComponentsPage,
  DomainsPage,
  GeneralPage,
  InboxPage,
  IntegrationsPage,
  MyTicketsPage,
  QueuePage,
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
  agents: AgentsState | null;
  config: WorkspaceConfig | null;
  now: number;
  onAnswer(runId: string): void;
  onOpenTicket(projectId: string, ticketId: string): void;
  onAssign(projectId: string, ticketId: string): void;
  onFile(ticketId: string): void;
  onOpen(target: TabTarget): void;
  onShare(projectId: string): void;
  onDeleteProject(projectId: string): void;
  onNewTicket(): void;
};

export function ScreenView(props: Props) {
  const {
    screen,
    projects,
    agents,
    config,
    now,
    onAnswer,
    onOpen,
    onShare,
    onDeleteProject,
    onNewTicket,
    ...p
  } = props;
  if (screen === "components") return <ComponentsPage onOpen={onOpen} />;
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
  if (screen === "sources") return <ComponentSourcesPage />;
  if (screen === "shortcuts") return <ShortcutsPage />;
  if (screen === "mine")
    return <MyTicketsPage projects={withInbox(projects, p.snapshots)} config={config} {...p} />;
  if (screen === "inbox")
    return (
      <InboxPage
        snapshot={p.snapshots.get(INBOX_ID) ?? null}
        projects={projects}
        viewer={p.viewer}
        onOpenTicket={(ticketId) => p.onOpenTicket(INBOX_ID, ticketId)}
        onNewTicket={onNewTicket}
      />
    );
  if (screen === "workspace") return <WorkspacePage config={config} />;
  if (!config) return null;
  if (screen === "domains") return <DomainsPage config={config} projects={projects} />;
  if (!agents) return null;
  if (screen === "agents")
    return <AgentsPage state={agents} config={config} now={now} onOpenRun={onAnswer} />;
  return <QueuePage state={agents} profiles={config.profiles} now={now} onAnswer={onAnswer} />;
}
