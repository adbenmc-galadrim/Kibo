import { type Domain, type FileRef, isFeature, isGroup, isInbox, type ProjectSnapshot } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot } from "lucide-react";
import { DeliverButton } from "../delivery/lazy";
import { fr } from "../i18n/fr";
import { frFeature, frGroup } from "../i18n/fr-group";
import { frPresence } from "../i18n/fr-presence";
import { canEdit } from "../state/access";
import { usePresencePeers } from "../state/use-presence";
import { TicketTabs, useTicketTab } from "../ticket/activity/TicketTabs";
import { LabelsField } from "../ticket/LabelsField";
import { TicketActionsMenu } from "../ticket/TicketActionsMenu";
import { TicketTitle } from "../ticket/TicketTitle";
import { useTicketCommand } from "../ticket/use-ticket-command";
import { FeatureDetail } from "./FeatureDetail";
import { GroupDetail } from "./GroupDetail";
import { KeyRequired } from "./KeyRequired";
import { ActivityTab } from "./lazy-screens";
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
  const labelsCommand = useTicketCommand(project.meta.id);
  const [tab, setTab] = useTicketTab();
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  const editable = canEdit(project);
  const inbox = isInbox(project.meta.id);
  const group = isGroup(t);
  const actions = (
    <TicketActionsMenu
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-[min(90vw,560px)]">
          <SheetHeader className="sr-only">
            <SheetTitle>{t.title}</SheetTitle>
            <SheetDescription>{frFeature.kicker(t.shortKey, t.keyLabel)}</SheetDescription>
          </SheetHeader>
          <FeatureDetail
            project={project}
            ticket={t}
            actions={<span className="mr-8">{actions}</span>}
            onOpenFile={onOpenFile}
            onOpenTicket={onOpenTicket}
          />
        </SheetContent>
      </Sheet>
    );
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
              {group ? frGroup.kicker(t.keyLabel) : <TicketKeyLabel ticket={t} />}
            </SheetDescription>
            <GithubRefs ticket={t} />
            <span className="mr-8 ml-auto flex items-center gap-2">{actions}</span>
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
          <GithubLinkNote ticket={t} />
          {!inbox && (
            <div className="mt-2 flex flex-wrap gap-2">
              {!group && (
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
              )}
              {editable && (
                <DeliverButton key={project.meta.delivery?.agent ?? ""} project={project} ticket={t} />
              )}
            </div>
          )}
        </SheetHeader>
        {group ? (
          <GroupDetail project={project} ticket={t} onOpenFile={onOpenFile} onOpenTicket={onOpenTicket} />
        ) : (
          <TicketTabs
            tab={tab}
            onTab={setTab}
            details={
              <TicketDetail
                project={project}
                ticket={t}
                domains={domains}
                viewer={viewer}
                onOpenFile={onOpenFile}
                onOpenTicket={onOpenTicket}
              />
            }
            activity={<ActivityTab project={project} ticket={t} onOpenFile={onOpenFile} />}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
