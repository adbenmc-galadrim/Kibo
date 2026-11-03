import { useHost } from "@kibo/ui/host";
import { TicketBody } from "@kibo/ui/ticket";
import { fr } from "../../i18n/fr";
import { frTicket } from "../../i18n/fr-ticket";
import type { RemoteClient } from "../../remote-client";
import { useProjectSnapshot } from "../../use-project";
import { useViewer } from "../../use-viewer";
import { TicketActions } from "./TicketActions";

type Props = {
  client: RemoteClient;
  projectId: string;
  ticketId: string;
  editable: boolean;
  onDeleted(): void;
};

const MUTED = "p-4 text-[15px] text-(--tracking-mfg)";

export function TicketScreen({ client, projectId, ticketId, editable, onDeleted }: Props) {
  const host = useHost();
  const project = useProjectSnapshot(projectId);
  const viewer = useViewer(client);
  if (project === null || viewer === null) return <p className={MUTED}>{fr.loading}</p>;
  const ticket = project.tickets.find((t) => t.id === ticketId);
  if (!ticket) return <p className={MUTED}>{frTicket.missing}</p>;
  return (
    <article aria-label={ticket.keyLabel} className="phone-ticket grid gap-3 pb-6">
      <TicketActions project={project} ticket={ticket} editable={editable} onDeleted={onDeleted} />
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
