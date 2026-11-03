import { FINAL_STATUSES, isInbox, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { descendantCount, TicketActionsMenu, TicketTopBar } from "@kibo/ui/ticket";
import { Play } from "lucide-react";
import { frTicket } from "../../i18n/fr-ticket";
import type { Connectivity } from "../../remote-client";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  presence: Connectivity;
  onDeleted(): void;
};

function OfflineLaunch({ presence }: { presence: Connectivity }) {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled
      className="mx-4 h-11 gap-2 rounded-lg text-[15px] disabled:opacity-70"
    >
      <Play aria-hidden />
      {presence.phoneOnline ? frTicket.launchMacOff : frTicket.launchPhoneOffline}
    </Button>
  );
}

export function TicketActions({ project, ticket, presence, onDeleted }: Props) {
  const editable = presence.macOnline && presence.phoneOnline;
  const inbox = isInbox(project.meta.id);
  const launchable = !inbox && ticket.key !== null && !FINAL_STATUSES.includes(ticket.statusId);
  return (
    <>
      <TicketTopBar
        projectId={project.meta.id}
        ticket={ticket}
        folder={project.meta.folder}
        launch={editable && !inbox}
        openLinks={false}
        actions={
          <TicketActionsMenu
            projectId={project.meta.id}
            ticket={ticket}
            childCount={descendantCount(project.tickets, ticket.id)}
            editable={editable}
            onOpenInTab={null}
            onDeleted={onDeleted}
            questions={inbox ? undefined : project.questions}
          />
        }
      />
      {!editable && launchable ? <OfflineLaunch presence={presence} /> : null}
    </>
  );
}
