import type { Domain, FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { LinkifiedText } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { GitPullRequest } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domains?: Domain[];
  onOpenFile(ref: FileRef): void;
};

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

export function TicketDetail({ project, ticket: t, domains, onOpenFile }: Props) {
  const status = project.workflow.find((s) => s.id === t.statusId)?.label ?? t.statusId;
  const children = project.tickets.filter((x) => x.parentId === t.id);
  const prs = t.externalRefs.filter((r) => r.kind === "github_pr");
  const open = (r: { path: string; line: number | null }) =>
    onOpenFile({ projectId: project.meta.id, worktree: null, path: r.path, line: r.line, origin: t.key });
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-[120px_1fr] items-center gap-y-2 px-4 text-xs">
        <dt className="text-muted-foreground">{fr.ticket.status}</dt>
        <dd>{status}</dd>
        {domains && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.domain}</dt>
            <dd>
              <DomainSelect project={project} ticket={t} domains={domains} />
            </dd>
          </>
        )}
        {t.blockedReason && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.blockedReason}</dt>
            <dd className="text-red-600 dark:text-red-400">{t.blockedReason}</dd>
          </>
        )}
        {t.waitingOn.length > 0 && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.waiting}</dt>
            <dd className="flex gap-1">
              {t.waitingOn.map((k) => (
                <Badge key={k} variant="outline">
                  {k}
                </Badge>
              ))}
            </dd>
          </>
        )}
        {prs.length > 0 && (
          <>
            <dt className="text-muted-foreground">{fr.ticket.prs}</dt>
            <dd className="flex flex-wrap gap-1">
              {prs.map((pr) => (
                <Badge key={pr.url} variant="outline" asChild>
                  <a href={pr.url} target="_blank" rel="noreferrer" title={fr.ticket.prState[pr.state]}>
                    <GitPullRequest aria-hidden />
                    <span>#{pr.number}</span>
                  </a>
                </Badge>
              ))}
            </dd>
          </>
        )}
      </dl>
      <section className="grid gap-2 px-4 text-sm">
        <h3 className="text-xs font-medium">{fr.ticket.description}</h3>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {t.description ? <LinkifiedText text={t.description} onOpen={open} /> : "-"}
        </p>
      </section>
      {children.length > 0 && (
        <section className="grid gap-1 px-4 text-xs">
          <h3 className="font-medium">
            {fr.ticket.subtickets} {`${t.progress.done}/${t.progress.total}`}
          </h3>
          {children.map((c) => (
            <p key={c.id}>
              <span className="font-mono text-2xs text-muted-foreground">{c.key}</span> {c.title}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
