import type { AgentsState, ProjectSnapshot, Screen, Session, TabTarget } from "@kibo/schema";
import { Breadcrumb, crumbsFor } from "./Breadcrumb";
import { CreationsIndicator, ProjectAgentButton, ScreenActions } from "./lazy-screens";
import { ExecutionGate } from "./nav/ExecutionGate";
import { SidebarToggle } from "./nav/SidebarToggle";
import { SyncChip } from "./nav/SyncChip";
import { PageActionsSlot, PagePresenceSlot } from "./page-actions";
import { RunHistoryButton } from "./RunHistoryButton";

type Props = {
  active: TabTarget | null;
  screen: Screen | null;
  project: ProjectSnapshot | null;
  branch: string | null;
  gitError: string | null;
  agents: AgentsState | null;
  agentPanel: { available: boolean; open: boolean; toggle(): void; show(tab: "signals"): void };
  notifications: Session["notifications"];
  now: number;
  onNewAgent: () => void;
  onNewSkill: () => void;
  onOpenRun(runId: string): void;
  onOpen(target: TabTarget, keep?: boolean): void;
};

const HEADING_SCREENS: ReadonlySet<Screen> = new Set(["agents", "queue", "skills", "mine"]);

export function ShellHeader({
  active,
  screen,
  project,
  branch,
  gitError,
  agents,
  agentPanel,
  notifications,
  now,
  onNewAgent,
  onNewSkill,
  onOpenRun,
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
      <SyncChip project={project} />
      <PagePresenceSlot />
      <PageActionsSlot />
      <ScreenActions screen={screen} agents={agents} onNewAgent={onNewAgent} onNewSkill={onNewSkill} />
      {project && agentPanel.available && (
        <ProjectAgentButton
          projectId={project.meta.id}
          agents={agents}
          open={agentPanel.open}
          onToggle={agentPanel.toggle}
          onOpenSignals={() => agentPanel.show("signals")}
        />
      )}
      <ExecutionGate>
        <CreationsIndicator agents={agents} onOpen={() => onOpen({ kind: "screen", screen: "creations" })} />
        <RunHistoryButton agents={agents} notifications={notifications} now={now} onOpenRun={onOpenRun} />
      </ExecutionGate>
    </header>
  );
}
