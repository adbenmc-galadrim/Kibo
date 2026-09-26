import type { Domain, FileRef, ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot, Maximize2 } from "lucide-react";
import { fr } from "../i18n/fr";
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
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetDescription className="font-mono">{t.key}</SheetDescription>
          <SheetTitle>{t.title}</SheetTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-brand/50 text-brand-strong dark:text-brand"
              onClick={onAssign}
            >
              <Bot />
              {fr.ticket.assignAgent}
            </Button>
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
