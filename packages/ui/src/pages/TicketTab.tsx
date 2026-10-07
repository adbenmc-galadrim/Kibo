import { type Domain, type FileRef, isInbox, type ProjectSnapshot } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Bot } from "lucide-react";
import { fr } from "../i18n/fr";
import { KeyRequired } from "../shell/KeyRequired";
import { importTitle } from "../shell/sheet/import-title";
import { GithubLinkNote, GithubRefs } from "../shell/sheet/lazy-sections";
import { descendantCount, TicketDetail } from "../shell/TicketDetail";
import { canEdit } from "../state/access";
import { TicketActionsMenu } from "../ticket/TicketActionsMenu";
import { TicketTitle } from "../ticket/TicketTitle";
import { useTicketCommand } from "../ticket/use-ticket-command";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  domains?: Domain[];
  viewer: string;
  onAssign?(ticketId: string): void;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

export function TicketTab({ project, ticketId, domains, viewer, onAssign, onOpenFile, onOpenTicket }: Props) {
  const command = useTicketCommand(project.meta.id);
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return <p className="p-8 text-sm text-muted-foreground">{fr.tabs.missingTicket}</p>;
  const editable = canEdit(project);
  return (
    <article className="mx-auto grid max-w-3xl gap-4 py-8">
      <header className="grid gap-1 px-4">
        <div className="flex items-center gap-2">
          <TicketKeyLabel ticket={t} className="font-mono text-xs text-muted-foreground" />
          <GithubRefs ticket={t} />
          <span className="ml-auto flex items-center gap-2">
            <TicketActionsMenu
              projectId={project.meta.id}
              ticket={t}
              childCount={descendantCount(project.tickets, t.id)}
              editable={editable}
              onOpenInTab={null}
              onDeleted={() => undefined}
            />
          </span>
        </div>
        <h1 className="text-lg font-semibold" aria-label={t.title} title={importTitle(t.externalRefs)}>
          <TicketTitle
            title={t.title}
            editable={editable}
            error={command.error}
            onSave={(title) => command.run({ method: "updateTicket", ticketId: t.id, title })}
            onCancel={command.clearError}
          />
        </h1>
        <GithubLinkNote ticket={t} />
        {onAssign && !isInbox(project.meta.id) && (
          <KeyRequired ticket={t}>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-fit border-brand/50 text-brand-strong dark:text-brand"
              onClick={() => onAssign(t.id)}
            >
              <Bot />
              {fr.ticket.assignAgent}
            </Button>
          </KeyRequired>
        )}
      </header>
      <TicketDetail
        project={project}
        ticket={t}
        domains={domains}
        viewer={viewer}
        onOpenFile={onOpenFile}
        onOpenTicket={onOpenTicket}
      />
    </article>
  );
}
