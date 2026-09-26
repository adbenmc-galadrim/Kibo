import type { Domain, FileRef, ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Bot } from "lucide-react";
import { fr } from "../i18n/fr";
import { TicketDetail } from "../shell/TicketDetail";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  domains?: Domain[];
  onAssign?(ticketId: string): void;
  onOpenFile(ref: FileRef): void;
};

export function TicketTab({ project, ticketId, domains, onAssign, onOpenFile }: Props) {
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return <p className="p-8 text-sm text-muted-foreground">{fr.tabs.missingTicket}</p>;
  return (
    <article className="mx-auto grid max-w-3xl gap-4 py-8">
      <header className="grid gap-1 px-4">
        <p className="font-mono text-xs text-muted-foreground">{t.key}</p>
        <h1 className="text-lg font-semibold">{t.title}</h1>
        {onAssign && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit border-brand/50 text-brand-strong dark:text-brand"
            onClick={() => onAssign(t.id)}
          >
            <Bot />
            {fr.ticket.assignAgent}
          </Button>
        )}
      </header>
      <TicketDetail project={project} ticket={t} domains={domains} onOpenFile={onOpenFile} />
    </article>
  );
}
