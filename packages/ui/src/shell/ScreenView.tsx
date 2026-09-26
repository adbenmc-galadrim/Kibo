import type { AgentsState, ProjectSummary, WorkspaceConfig } from "@kibo/schema";
import { AgentsPage } from "../agents/AgentsPage";
import { QueuePage } from "../agents/QueuePage";
import type { Screen } from "../route";
import { DomainsPage } from "../settings/DomainsPage";

type Props = {
  screen: Screen;
  projects: ProjectSummary[];
  agents: AgentsState | null;
  config: WorkspaceConfig | null;
  now: number;
  onAnswer(runId: string): void;
};

export function ScreenView({ screen, projects, agents, config, now, onAnswer }: Props) {
  if (!config) return null;
  if (screen === "domains") return <DomainsPage config={config} projects={projects} />;
  if (!agents) return null;
  if (screen === "agents") return <AgentsPage state={agents} config={config} now={now} />;
  return <QueuePage state={agents} profiles={config.profiles} now={now} onAnswer={onAnswer} />;
}
