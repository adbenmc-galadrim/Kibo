import type { AgentsState, ProjectSnapshot, Screen, Session, TabTarget } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { SidebarTrigger } from "@kibo/sdk/ui/sidebar";
import { Bell, Plus } from "lucide-react";
import { fr } from "../i18n/fr";
import { canEdit } from "../state/access";
import { Breadcrumb, crumbsFor } from "./Breadcrumb";
import { ShareButton } from "./lazy-screens";
import { NotifyButton } from "./NotifyButton";
import { PageActionsSlot } from "./page-actions";
import { ScreenActions } from "./ScreenActions";
import { UserAvatar } from "./UserAvatar";

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
  onNewProfile: () => void;
  onNewTicket: () => void;
  onShare: () => void;
};

const HEADING_SCREENS: ReadonlySet<Screen> = new Set(["agents", "queue", "components", "mine"]);

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
  onNewProfile,
  onNewTicket,
  onShare,
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
      {project && <ShareButton onShare={onShare} />}
      {ticketProject && canEdit(ticketProject) && (
        <Button
          size="sm"
          className="h-7"
          title={fr.header.newTicketIn(ticketProject.meta.name)}
          onClick={onNewTicket}
        >
          <Plus />
          {fr.header.newTicket}
        </Button>
      )}
      {notifications === "browser" ? (
        <NotifyButton />
      ) : (
        <Bell aria-hidden className="size-4 text-muted-foreground" />
      )}
      <UserAvatar user={viewer} />
    </header>
  );
}
