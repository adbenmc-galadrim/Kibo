import {
  INBOX_ID,
  type ProjectSnapshot,
  type ProjectSummary,
  type Screen,
  type WorkspaceConfig,
} from "@kibo/schema";
import { withInbox } from "../lib/inbox";
import {
  AppearancePage,
  GeneralPage,
  InboxPage,
  IntegrationsPage,
  MyTicketsPage,
  ShortcutsPage,
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
  onNewTicket(): void;
};

export function ScreenView(props: Props) {
  const { screen, projects, config, onNewTicket, ...p } = props;
  if (screen === "general") return <GeneralPage />;
  if (screen === "integrations") return <IntegrationsPage />;
  if (screen === "appearance") return <AppearancePage />;
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
