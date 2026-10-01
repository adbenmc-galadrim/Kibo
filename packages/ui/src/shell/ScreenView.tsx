import type {
  AgentsState,
  ProjectSnapshot,
  ProjectSummary,
  Screen,
  TabTarget,
  WorkspaceConfig,
} from "@kibo/schema";
import {
  AgentsPage,
  AppearancePage,
  ComponentSourcesPage,
  ComponentsPage,
  DomainsPage,
  GeneralPage,
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
  onOpen(target: TabTarget): void;
};

export function ScreenView({ screen, projects, agents, config, now, onAnswer, onOpen, ...p }: Props) {
  if (screen === "components") return <ComponentsPage onOpen={onOpen} />;
  if (screen === "general") return <GeneralPage />;
  if (screen === "integrations") return <IntegrationsPage />;
  if (screen === "appearance") return <AppearancePage />;
  if (screen === "security") return <SecurityPage />;
  if (screen === "sync") return <SyncSettingsPage viewer={p.viewer} projects={projects} />;
  if (screen === "sources") return <ComponentSourcesPage />;
  if (screen === "shortcuts") return <ShortcutsPage />;
  if (screen === "mine") return <MyTicketsPage projects={projects} config={config} {...p} />;
  if (screen === "workspace") return <WorkspacePage config={config} />;
  if (!config) return null;
  if (screen === "domains") return <DomainsPage config={config} projects={projects} />;
  if (!agents) return null;
  if (screen === "agents") return <AgentsPage state={agents} config={config} now={now} />;
  return <QueuePage state={agents} profiles={config.profiles} now={now} onAnswer={onAnswer} />;
}
