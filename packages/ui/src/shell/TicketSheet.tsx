import { type Domain, type FileRef, isInbox, type ProjectSnapshot } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot } from "lucide-react";
import { fr } from "../i18n/fr";
import { frPresence } from "../i18n/fr-presence";
import { canEdit } from "../state/access";
import { usePresencePeers } from "../state/use-presence";
import { TicketActionsMenu } from "../ticket/TicketActionsMenu";
import { TicketTitle } from "../ticket/TicketTitle";
import { useTicketCommand } from "../ticket/use-ticket-command";
import { KeyRequired } from "./KeyRequired";
import { importTitle } from "./sheet/import-title";
import { GithubLinkNote, GithubRefs } from "./sheet/lazy-sections";
import { descendantCount, TicketDetail } from "./TicketDetail";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  domains: Domain[];
  viewer: string;
  onClose(): void;
  onAssign(): void;
  onFile?: () => void;
  onOpenInTab(): void;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
  onDeleted(): void;
};

export function TicketSheet({
  project,
  ticketId,
  domains,
  viewer,
  onClose,
  onAssign,
  onFile,
  onOpenInTab,
  onOpenFile,
  onOpenTicket,
  onDeleted,
}: Props) {
  const peers = usePresencePeers(project.sync.shared ? project.meta.id : null).filter(
    (p) => !p.self && p.ticketId === ticketId,
  );
  const command = useTicketCommand(project.meta.id);
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  const editable = canEdit(project);
  const inbox = isInbox(project.meta.id);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[min(90vw,560px)] overflow-y-auto">
        <SheetHeader>
          {peers.map((p) => (
            <p key={p.deviceId} className="mr-8 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
              {frPresence.watching(p.name)}
            </p>
          ))}
          <div className="flex items-center gap-2">
            <SheetDescription className="font-mono text-xs">
              <TicketKeyLabel ticket={t} />
            </SheetDescription>
            <GithubRefs ticket={t} />
            <span className="mr-8 ml-auto flex items-center gap-2">
              <TicketActionsMenu
                projectId={project.meta.id}
                ticket={t}
                childCount={descendantCount(project.tickets, t.id)}
                editable={editable}
                onOpenInTab={onOpenInTab}
                onFile={inbox ? onFile : undefined}
                onDeleted={onDeleted}
              />
            </span>
          </div>
          <SheetTitle className="text-lg" aria-label={t.title} title={importTitle(t.externalRefs)}>
            <TicketTitle
              title={t.title}
              editable={editable}
              error={command.error}
              onSave={(title) => command.run({ method: "updateTicket", ticketId: t.id, title })}
              onCancel={command.clearError}
            />
          </SheetTitle>
          <GithubLinkNote ticket={t} />
          {!inbox && (
            <div className="mt-2 flex flex-wrap gap-2">
              <KeyRequired ticket={t}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-brand/50 text-brand-strong dark:text-brand"
                  onClick={onAssign}
                >
                  <Bot />
                  {fr.ticket.assignAgent}
                </Button>
              </KeyRequired>
            </div>
          )}
        </SheetHeader>
        <TicketDetail
          project={project}
          ticket={t}
          domains={domains}
          viewer={viewer}
          onOpenFile={onOpenFile}
          onOpenTicket={onOpenTicket}
        />
      </SheetContent>
    </Sheet>
  );
}
