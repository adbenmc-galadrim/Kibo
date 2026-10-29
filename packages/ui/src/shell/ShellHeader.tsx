import type { AgentsState, ProjectSnapshot, Screen, TabTarget } from "@kibo/schema";
import { Breadcrumb, crumbsFor } from "./Breadcrumb";
import { ProjectAgentButton } from "./lazy-screens";
import { OfflineChip } from "./nav/OfflineChip";
import { SidebarToggle } from "./nav/SidebarToggle";
import { PageActionsSlot } from "./page-actions";

type Props = {
  active: TabTarget | null;
  screen: Screen | null;
  project: ProjectSnapshot | null;
  branch: string | null;
  gitError: string | null;
  agents: AgentsState | null;
  agentPanel: { available: boolean; open: boolean; toggle(): void; show(): void };
  onOpen(target: TabTarget, keep?: boolean): void;
};

const HEADING_SCREENS: ReadonlySet<Screen> = new Set(["mine"]);

export function ShellHeader({
  active,
  screen,
  project,
  branch,
  gitError,
  agents,
  agentPanel,
  onOpen,
}: Props) {
  return (
    <header className="k-top">
      <SidebarToggle whenClosed />
      <Breadcrumb
        crumbs={crumbsFor(active, { project, branch, runs: agents?.runs })}
        heading={screen !== null && HEADING_SCREENS.has(screen)}
        onOpen={onOpen}
      />
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
          onOpen={agentPanel.show}
        />
      )}
    </header>
  );
}
