import type { AgentsState, ProjectSnapshot, ProjectSummary, Screen, WorkspaceConfig } from "@kibo/schema";
import { AgentsPage, ComponentsPage, DomainsPage, MyTicketsPage, QueuePage } from "./lazy-screens";

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
};

export function ScreenView({ screen, projects, agents, config, now, onAnswer, ...p }: Props) {
  if (screen === "components") return <ComponentsPage />;
  if (screen === "mine") return <MyTicketsPage projects={projects} config={config} {...p} />;
  if (!config) return null;
  if (screen === "domains") return <DomainsPage config={config} projects={projects} />;
  if (!agents) return null;
  if (screen === "agents") return <AgentsPage state={agents} config={config} now={now} />;
  return <QueuePage state={agents} profiles={config.profiles} now={now} onAnswer={onAnswer} />;
}
