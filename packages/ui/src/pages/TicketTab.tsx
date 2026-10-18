import { type Domain, type FileRef, isFeature, isGroup, isInbox, type ProjectSnapshot } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { frGroup } from "../i18n/fr-group";
import { FeatureDetail } from "../shell/FeatureDetail";
import { GroupDetail } from "../shell/GroupDetail";
import { importTitle } from "../shell/sheet/import-title";
import { GithubRefs } from "../shell/sheet/lazy-sections";
import { descendantCount } from "../shell/TicketDetail";
import { canEdit } from "../state/access";
import { findTicket } from "../tabs/target-hash";
import { LabelsField } from "../ticket/LabelsField";
import { TicketActionsMenu } from "../ticket/TicketActionsMenu";
import { TicketBody } from "../ticket/TicketBody";
import { TicketTitle } from "../ticket/TicketTitle";
import { TicketTopBar } from "../ticket/TicketTopBar";
import { useTicketAddress } from "../ticket/use-ticket-address";
import { useTicketCommand } from "../ticket/use-ticket-command";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  domains?: Domain[];
  viewer: string;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

const HEADING = "text-[22px] font-semibold tracking-[-0.3px]";

export function TicketTab({ project, ticketId, domains, viewer, onOpenFile, onOpenTicket }: Props) {
  const command = useTicketCommand(project.meta.id);
  const labelsCommand = useTicketCommand(project.meta.id);
  const t = findTicket(project.tickets, ticketId);
  useTicketAddress(project.meta.id, t);
  if (!t) return <p className="p-8 text-sm text-muted-foreground">{fr.tabs.missingTicket}</p>;
  if (isFeature(t))
    return <FeatureDetail project={project} ticket={t} onOpenFile={onOpenFile} onOpenTicket={onOpenTicket} />;
  const editable = canEdit(project);
  const actions = (
    <TicketActionsMenu
      projectId={project.meta.id}
      ticket={t}
      childCount={descendantCount(project.tickets, t.id)}
      editable={editable}
      onOpenInTab={null}
      onDeleted={() => undefined}
    />
  );
  if (isGroup(t))
    return (
      <article className="mx-auto grid w-full max-w-3xl gap-4 py-8">
        <header className="grid gap-1 px-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{frGroup.kicker(t.keyLabel)}</span>
            <GithubRefs ticket={t} />
            <span className="ml-auto flex items-center gap-2">{actions}</span>
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
        </header>
        <GroupDetail project={project} ticket={t} onOpenFile={onOpenFile} onOpenTicket={onOpenTicket} />
      </article>
    );
  return (
    <article className="mx-auto w-full max-w-3xl py-4">
      <TicketTopBar
        projectId={project.meta.id}
        ticket={t}
        questions={project.questions}
        copy={!isInbox(project.meta.id)}
        actions={actions}
      />
      <TicketBody
        project={project}
        ticket={t}
        domains={domains}
        viewer={viewer}
        heading={(title, label) => (
          <h1 className={HEADING} aria-label={label} title={importTitle(t.externalRefs)}>
            {title}
          </h1>
        )}
        onOpenFile={onOpenFile}
        onOpenTicket={onOpenTicket}
      />
    </article>
  );
}
