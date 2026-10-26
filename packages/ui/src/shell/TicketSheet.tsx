import { type Domain, type FileRef, isFeature, isGroup, isInbox, type ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@kibo/sdk/ui/sheet";
import { X } from "lucide-react";
import { frFeature, frGroup } from "../i18n/fr-group";
import { frPresence } from "../i18n/fr-presence";
import { frTicketTracking } from "../i18n/fr-ticket-tracking";
import { canEdit } from "../state/access";
import { usePresencePeers } from "../state/use-presence";
import { findTicket } from "../tabs/target-hash";
import { LabelsField } from "../ticket/LabelsField";
import { TicketActionsMenu } from "../ticket/TicketActionsMenu";
import { TicketBody } from "../ticket/TicketBody";
import { TicketTitle } from "../ticket/TicketTitle";
import { TicketTopBar } from "../ticket/TicketTopBar";
import { useTicketCommand } from "../ticket/use-ticket-command";
import { FeatureDetail } from "./FeatureDetail";
import { GroupDetail } from "./GroupDetail";
import { importTitle } from "./sheet/import-title";
import { GithubRefs } from "./sheet/lazy-sections";
import { descendantCount } from "./TicketDetail";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  domains: Domain[];
  viewer: string;
  onClose(): void;
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
  onFile,
  onOpenInTab,
  onOpenFile,
  onOpenTicket,
  onDeleted,
}: Props) {
  const t = findTicket(project.tickets, ticketId);
  const peers = usePresencePeers(project.sync.shared ? project.meta.id : null).filter(
    (p) => !p.self && p.ticketId === t?.id,
  );
  const command = useTicketCommand(project.meta.id);
  const labelsCommand = useTicketCommand(project.meta.id);
  if (!t) return null;
  const editable = canEdit(project);
  const inbox = isInbox(project.meta.id);
  const actionsMenu = (extra?: MenuEntry[]) => (
    <TicketActionsMenu
      extra={extra}
      projectId={project.meta.id}
      ticket={t}
      childCount={descendantCount(project.tickets, t.id)}
      editable={editable}
      onOpenInTab={onOpenInTab}
      onFile={inbox ? onFile : undefined}
      onDeleted={onDeleted}
    />
  );
  if (isFeature(t))
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full overflow-x-hidden overflow-y-auto sm:max-w-[min(90vw,560px)]">
          <SheetHeader className="sr-only">
            <SheetTitle>{t.title}</SheetTitle>
            <SheetDescription>{frFeature.kicker(t.shortKey, t.keyLabel)}</SheetDescription>
          </SheetHeader>
          <FeatureDetail
            project={project}
            ticket={t}
            actions={(extra) => <span className="mr-8">{actionsMenu(extra)}</span>}
            onOpenFile={onOpenFile}
            onOpenTicket={onOpenTicket}
          />
        </SheetContent>
      </Sheet>
    );
  const notice = peers.map((p) => (
    <p key={p.deviceId} className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
      {frPresence.watching(p.name)}
    </p>
  ));
  if (isGroup(t))
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full overflow-x-hidden overflow-y-auto sm:max-w-[min(90vw,560px)]">
          <SheetHeader>
            {notice}
            <div className="flex items-center gap-2">
              <SheetDescription className="font-mono text-xs">{frGroup.kicker(t.keyLabel)}</SheetDescription>
              <GithubRefs ticket={t} />
              <span className="mr-8 ml-auto flex items-center gap-2">{actionsMenu()}</span>
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
            <LabelsField ticket={t} editable={editable} command={labelsCommand} />
          </SheetHeader>
          <GroupDetail project={project} ticket={t} onOpenFile={onOpenFile} onOpenTicket={onOpenTicket} />
        </SheetContent>
      </Sheet>
    );
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        showCloseButton={false}
        className="w-full sm:max-w-[min(90vw,560px)] gap-0 overflow-x-hidden overflow-y-auto"
      >
        <SheetDescription className="sr-only">{`${t.keyLabel} · ${t.title}`}</SheetDescription>
        <TicketTopBar
          projectId={project.meta.id}
          ticket={t}
          questions={project.questions}
          copy={!inbox}
          actions={actionsMenu()}
          close={
            <SheetClose asChild>
              <Button variant="ghost" size="sm" className="h-[25px] text-xs text-muted-foreground">
                <X />
                {frTicketTracking.close}
              </Button>
            </SheetClose>
          }
        />
        <TicketBody
          project={project}
          ticket={t}
          domains={domains}
          viewer={viewer}
          notice={notice}
          heading={(title, label) => (
            <SheetTitle
              className="text-[22px] font-semibold tracking-[-0.3px]"
              aria-label={label}
              title={importTitle(t.externalRefs)}
            >
              {title}
            </SheetTitle>
          )}
          onOpenFile={onOpenFile}
          onOpenTicket={onOpenTicket}
        />
      </SheetContent>
    </Sheet>
  );
}
