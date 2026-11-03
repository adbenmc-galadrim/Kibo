import { useHost } from "@kibo/ui/host";
import { TicketBody } from "@kibo/ui/ticket";
import { fr } from "../../i18n/fr";
import { frTicket } from "../../i18n/fr-ticket";
import type { Connectivity, RemoteClient } from "../../remote-client";
import { useProjectSnapshot } from "../../use-project";
import { useViewer } from "../../use-viewer";
import { canWrite } from "../../write-block";
import { TicketActions } from "./TicketActions";

type Props = {
  client: RemoteClient;
  projectId: string;
  ticketId: string;
  presence: Connectivity;
  onDeleted(): void;
};

const MUTED = "p-4 text-[15px] text-(--tracking-mfg)";

export function TicketScreen({ client, projectId, ticketId, presence, onDeleted }: Props) {
  const editable = canWrite(presence);
  const host = useHost();
  const project = useProjectSnapshot(projectId);
  const { viewer, failed } = useViewer(client);
  if (failed)
    return (
      <p role="alert" className="p-4 text-[15px] text-(--tracking-red)">
        {fr.sessionFailed}
      </p>
    );
  if (project === null || viewer === null) return <p className={MUTED}>{fr.loading}</p>;
  const ticket = project.tickets.find((t) => t.id === ticketId);
  if (!ticket) return <p className={MUTED}>{frTicket.missing}</p>;
  return (
    <article aria-label={ticket.keyLabel} className="phone-ticket grid gap-3 pb-6">
      <TicketActions project={project} ticket={ticket} presence={presence} onDeleted={onDeleted} />
      <TicketBody
        project={project}
        ticket={ticket}
        domains={project.domains}
        viewer={viewer}
        heading={(title, label) => (
          <h1 aria-label={label} className="text-[24px] leading-tight font-semibold">
            {title}
          </h1>
        )}
        onOpenTicket={host.openTicket}
        surface={{ design: false, editable, ciLogOffline: frTicket.ciLogOffline }}
      />
    </article>
  );
}
