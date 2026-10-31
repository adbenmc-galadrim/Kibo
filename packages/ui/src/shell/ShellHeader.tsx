import type { AgentsState, ProjectSnapshot, TabTarget } from "@kibo/schema";
import { Breadcrumb, crumbsFor } from "./Breadcrumb";
import { ProjectAgentButton } from "./lazy-screens";
import { OfflineChip } from "./nav/OfflineChip";
import { SidebarToggle } from "./nav/SidebarToggle";
import { PageActionsSlot } from "./page-actions";

type Props = {
  active: TabTarget | null;
  project: ProjectSnapshot | null;
  gitError: string | null;
  agents: AgentsState | null;
  agentPanel: { available: boolean; open: boolean; toggle(): void; show(): void };
  onOpen(target: TabTarget, keep?: boolean): void;
};

export function ShellHeader({ active, project, gitError, agents, agentPanel, onOpen }: Props) {
  return (
    <header className="k-top">
      <SidebarToggle whenClosed />
      <Breadcrumb crumbs={crumbsFor(active, { project })} onOpen={onOpen} />
      <span className="flex-1" />
      {gitError && (
        <p role="alert" className="truncate text-xs text-destructive">
          {gitError}
        </p>
      )}
      <OfflineChip />
      <PageActionsSlot />
      {project && agentPanel.available && (
        <ProjectAgentButton
          projectId={project.meta.id}
          agents={agents}
          open={agentPanel.open}
          onToggle={agentPanel.toggle}
        />
      )}
    </header>
  );
}
