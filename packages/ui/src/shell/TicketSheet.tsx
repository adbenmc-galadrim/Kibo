import type { Domain, FileRef, ProjectSnapshot } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot, Maximize2 } from "lucide-react";
import { fr } from "../i18n/fr";
import { frPresence } from "../i18n/fr-presence";
import { usePresencePeers } from "../state/use-presence";
import { KeyRequired } from "./KeyRequired";
import { GithubLinkNote, GithubRefs } from "./sheet/lazy-sections";
import { TicketDetail } from "./TicketDetail";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  domains: Domain[];
  onClose(): void;
  onAssign(): void;
  onOpenInTab(): void;
  onOpenFile(ref: FileRef): void;
};

export function TicketSheet({
  project,
  ticketId,
  domains,
  onClose,
  onAssign,
  onOpenInTab,
  onOpenFile,
}: Props) {
  const peers = usePresencePeers(project.sync.shared ? project.meta.id : null).filter(
    (p) => !p.self && p.ticketId === ticketId,
  );
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
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
          </div>
          <SheetTitle className="text-lg">{t.title}</SheetTitle>
          <GithubLinkNote ticket={t} />
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
            <Button variant="outline" size="sm" onClick={onOpenInTab}>
              <Maximize2 />
              {fr.ticket.openInTab}
            </Button>
          </div>
        </SheetHeader>
        <TicketDetail project={project} ticket={t} domains={domains} onOpenFile={onOpenFile} />
      </SheetContent>
    </Sheet>
  );
}
