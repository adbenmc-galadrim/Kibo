import type { Domain, FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frTicketEdit } from "../i18n/fr-ticket-edit";
import { canEdit } from "../state/access";
import { AssigneeSelect } from "../ticket/AssigneeSelect";
import { DependenciesSection } from "../ticket/DependenciesSection";
import { DescriptionEditor } from "../ticket/DescriptionEditor";
import { StatusSelect } from "../ticket/StatusSelect";
import { useTicketCommand } from "../ticket/use-ticket-command";
import { CiSection, FigmaProperty, FigmaSection, SyncStatus } from "./sheet/lazy-sections";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domains?: Domain[];
  viewer: string;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

export const descendantCount = (tickets: readonly TicketView[], id: string): number =>
  tickets.filter((x) => x.parentId === id).reduce((n, c) => n + 1 + descendantCount(tickets, c.id), 0);

const NO_DOMAIN = "none";

function DomainSelect({
  project,
  ticket,
  domains,
}: {
  project: ProjectSnapshot;
  ticket: TicketView;
  domains: Domain[];
}) {
  const [failed, setFailed] = useState(false);
  const pick = async (value: string) => {
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId: project.meta.id,
        command: {
          method: "updateTicket",
          ticketId: ticket.id,
          domainId: value === NO_DOMAIN ? null : value,
        },
      });
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      <Select value={ticket.domainId ?? NO_DOMAIN} onValueChange={(v) => void pick(v)}>
        <SelectTrigger size="sm" aria-label={fr.ticket.domain} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_DOMAIN}>{fr.ticket.noDomain}</SelectItem>
          {domains.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <span aria-hidden className="size-2 rounded-[2px]" style={{ background: d.color }} />
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {failed && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {fr.ticket.domainFailed}
        </p>
      )}
    </>
  );
}

export function TicketDetail({ project, ticket: t, domains, viewer, onOpenFile, onOpenTicket }: Props) {
  const editable = canEdit(project);
  const command = useTicketCommand(project.meta.id);
  const descriptionCommand = useTicketCommand(project.meta.id);
  const children = project.tickets.filter((x) => x.parentId === t.id);
  const hasPr = t.externalRefs.some((r) => r.kind === "github_pr");
  const open = (r: { path: string; line: number | null }) =>
    onOpenFile({
      projectId: project.meta.id,
      worktree: null,
      path: r.path,
      line: r.line,
      origin: t.keyLabel,
    });
  return (
    <div className="grid gap-4">
      <SyncStatus projectId={project.meta.id} ticket={t} />
      <dl className="grid grid-cols-[120px_1fr] items-center gap-y-2 px-4 text-xs">
        <dt className="text-muted-foreground">{fr.ticket.status}</dt>
        <dd>
          <StatusSelect ticket={t} workflow={project.workflow} editable={editable} command={command} />
        </dd>
        {domains && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.domain}</dt>
            <dd>
              <DomainSelect project={project} ticket={t} domains={domains} />
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">{frTicketEdit.assignee}</dt>
        <dd>
          <AssigneeSelect
            ticket={t}
            viewer={viewer}
            members={project.sync.members}
            editable={editable}
            command={command}
          />
        </dd>
        {t.blockedReason && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.blockedReason}</dt>
            <dd className="text-red-600 dark:text-red-400">{t.blockedReason}</dd>
          </>
        )}
        <FigmaProperty ticket={t} />
      </dl>
      {command.error && (
        <p role="alert" className="px-4 text-sm text-destructive">
          {command.error}
        </p>
      )}
      <DependenciesSection project={project} ticket={t} editable={editable} onOpenTicket={onOpenTicket} />
      <DescriptionEditor
        ticketId={t.id}
        description={t.description}
        editable={editable}
        command={descriptionCommand}
        onOpenFile={open}
      />
      {children.length > 0 && (
        <section className="grid gap-1 px-4 text-xs">
          <h3 className="font-medium">
            {fr.ticket.subtickets} {`${t.progress.done}/${t.progress.total}`}
          </h3>
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              className="text-left hover:underline"
              onClick={() => onOpenTicket(c.id)}
            >
              <span className="font-mono text-2xs text-muted-foreground">{c.keyLabel}</span> {c.title}
            </button>
          ))}
        </section>
      )}
      {hasPr && <CiSection projectId={project.meta.id} ticketId={t.id} />}
      <FigmaSection projectId={project.meta.id} ticket={t} />
    </div>
  );
}
