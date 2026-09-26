import type { AgentsState, ProjectSummary, Screen, WorkspaceConfig } from "@kibo/schema";
import { AgentsPage, ComponentsPage, DomainsPage, QueuePage } from "./lazy-screens";

type Props = {
  screen: Screen;
  projects: ProjectSummary[];
  agents: AgentsState | null;
  config: WorkspaceConfig | null;
  now: number;
  onAnswer(runId: string): void;
};

export function ScreenView({ screen, projects, agents, config, now, onAnswer }: Props) {
  if (screen === "components") return <ComponentsPage />;
  if (!config) return null;
  if (screen === "domains") return <DomainsPage config={config} projects={projects} />;
  if (!agents) return null;
  if (screen === "agents") return <AgentsPage state={agents} config={config} now={now} />;
  return <QueuePage state={agents} profiles={config.profiles} now={now} onAnswer={onAnswer} />;
}
