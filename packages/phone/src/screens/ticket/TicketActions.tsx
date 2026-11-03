import { FINAL_STATUSES, isInbox, type ProjectSnapshot, type TicketView } from "@kibo/schema";
import { descendantCount, TicketActionsMenu, TicketTopBar } from "@kibo/ui/ticket";
import { Play } from "lucide-react";
import { frTicket } from "../../i18n/fr-ticket";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  editable: boolean;
  onDeleted(): void;
};

function OfflineLaunch() {
  return (
    <button
      type="button"
      disabled
      className="mx-4 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-(--tracking-panel) text-[15px] text-(--tracking-mfg)"
    >
      <Play aria-hidden size={16} />
      {frTicket.launchOffline}
    </button>
  );
}

export function TicketActions({ project, ticket, editable, onDeleted }: Props) {
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
      {!editable && launchable ? <OfflineLaunch /> : null}
    </>
  );
}
