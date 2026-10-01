import {
  type AgentsState,
  isInbox,
  type ProjectSnapshot,
  type Screen,
  type Session,
  type TabTarget,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { Plus } from "lucide-react";
import { fr } from "../i18n/fr";
import { displayName, inboxMeta } from "../lib/inbox";
import { canEdit } from "../state/access";
import { Breadcrumb, crumbsFor } from "./Breadcrumb";
import { ScreenActions, ShareButton } from "./lazy-screens";
import { PageActionsSlot } from "./page-actions";
import { RunHistoryButton } from "./RunHistoryButton";
import { UserMenu } from "./UserMenu";

type Props = {
  active: TabTarget | null;
  screen: Screen | null;
  project: ProjectSnapshot | null;
  ticketProject: ProjectSnapshot | null;
  branch: string | null;
  gitError: string | null;
  agents: AgentsState | null;
  viewer: string;
  notifications: Session["notifications"];
  now: number;
  onNewProfile: () => void;
  onNewTicket: () => void;
  onShare: () => void;
  onOpenRun(runId: string): void;
  onOpen(target: TabTarget): void;
};

const HEADING_SCREENS: ReadonlySet<Screen> = new Set(["agents", "queue", "components", "mine", "inbox"]);

export function ShellHeader({
  active,
  screen,
  project,
  ticketProject,
  branch,
  gitError,
  agents,
  viewer,
  notifications,
  now,
  onNewProfile,
  onNewTicket,
  onShare,
  onOpenRun,
  onOpen,
}: Props) {
  return (
    <header className="flex h-12 shrink-0 select-none items-center gap-2 border-b px-3">
      <SidebarTrigger />
      <Breadcrumb
        crumbs={crumbsFor(active, { project, branch })}
        heading={screen !== null && HEADING_SCREENS.has(screen)}
      />
      <PageActionsSlot />
      <span className="flex-1" />
      {gitError && (
        <p role="alert" className="truncate text-xs text-destructive">
          {gitError}
        </p>
      )}
      <ScreenActions screen={screen} agents={agents} onNewProfile={onNewProfile} />
      {project && !isInbox(project.meta.id) && <ShareButton onShare={onShare} />}
      <Button
        size="sm"
        className="h-7"
        title={fr.header.newTicketIn(
          displayName(ticketProject && canEdit(ticketProject) ? ticketProject.meta : inboxMeta()),
        )}
        onClick={onNewTicket}
      >
        <Plus />
        {fr.header.newTicket}
      </Button>
      <RunHistoryButton agents={agents} notifications={notifications} now={now} onOpenRun={onOpenRun} />
      <UserMenu viewer={viewer} onOpen={onOpen} />
    </header>
  );
}
