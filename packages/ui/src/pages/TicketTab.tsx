import { type Domain, type FileRef, isFeature, isGroup, isInbox, type ProjectSnapshot } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Bot } from "lucide-react";
import { DeliverButton } from "../delivery/lazy";
import { fr } from "../i18n/fr";
import { frGroup } from "../i18n/fr-group";
import { FeatureDetail } from "../shell/FeatureDetail";
import { GroupDetail } from "../shell/GroupDetail";
import { KeyRequired } from "../shell/KeyRequired";
import { ActivityTab } from "../shell/lazy-screens";
import { ExecutionGate } from "../shell/nav/ExecutionGate";
import { importTitle } from "../shell/sheet/import-title";
import { GithubLinkNote, GithubRefs } from "../shell/sheet/lazy-sections";
import { descendantCount, TicketDetail } from "../shell/TicketDetail";
import { canEdit } from "../state/access";
import { findTicket } from "../tabs/target-hash";
import { TicketTabs, useTicketTab } from "../ticket/activity/TicketTabs";
import { LabelsField } from "../ticket/LabelsField";
import { TicketActionsMenu } from "../ticket/TicketActionsMenu";
import { TicketTitle } from "../ticket/TicketTitle";
import { useTicketAddress } from "../ticket/use-ticket-address";
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
  const labelsCommand = useTicketCommand(project.meta.id);
  const [tab, setTab] = useTicketTab();
  const t = findTicket(project.tickets, ticketId);
  useTicketAddress(project.meta.id, t);
  if (!t) return <p className="p-8 text-sm text-muted-foreground">{fr.tabs.missingTicket}</p>;
  if (isFeature(t))
    return <FeatureDetail project={project} ticket={t} onOpenFile={onOpenFile} onOpenTicket={onOpenTicket} />;
  const editable = canEdit(project);
  const group = isGroup(t);
  return (
    <article className={cn("mx-auto grid w-full gap-4 py-8", tab === "activity" ? "max-w-7xl" : "max-w-3xl")}>
      <header className="grid gap-1 px-4">
        <div className="flex items-center gap-2">
          {group ? (
            <span className="font-mono text-xs text-muted-foreground">{frGroup.kicker(t.keyLabel)}</span>
          ) : (
            <TicketKeyLabel ticket={t} className="font-mono text-xs text-muted-foreground" />
          )}
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
        <LabelsField ticket={t} editable={editable} command={labelsCommand} />
        <GithubLinkNote ticket={t} />
        {group && editable && (
          <span className="mt-2 flex flex-wrap gap-2">
            <DeliverButton key={project.meta.delivery?.agent ?? ""} project={project} ticket={t} />
          </span>
        )}
        {onAssign && !group && !isInbox(project.meta.id) && (
          <ExecutionGate>
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
          </ExecutionGate>
        )}
      </header>
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
    </article>
  );
}
