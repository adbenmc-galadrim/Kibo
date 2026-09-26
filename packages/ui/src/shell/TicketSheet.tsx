import type { Domain, ProjectSnapshot } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = {
  project: ProjectSnapshot;
  ticketId: string;
  domains: Domain[];
  onClose: () => void;
  onAssign: () => void;
};

const NO_DOMAIN = "none";

export function TicketSheet({ project, ticketId, domains, onClose, onAssign }: Props) {
  const [failed, setFailed] = useState(false);
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  const status = project.workflow.find((s) => s.id === t.statusId)?.label ?? t.statusId;
  const children = project.tickets.filter((x) => x.parentId === t.id);
  const pickDomain = async (value: string) => {
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId: project.meta.id,
        command: { method: "updateTicket", ticketId: t.id, domainId: value === NO_DOMAIN ? null : value },
      });
    } catch {
      setFailed(true);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetDescription className="font-mono">{t.key}</SheetDescription>
          <SheetTitle>{t.title}</SheetTitle>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit border-brand/50 text-brand-strong dark:text-brand"
            onClick={onAssign}
          >
            <Bot />
            {fr.ticket.assignAgent}
          </Button>
        </SheetHeader>
        <dl className="grid grid-cols-[120px_1fr] items-center gap-y-2 px-4 text-sm">
          <dt className="text-muted-foreground">{fr.ticket.status}</dt>
          <dd>{status}</dd>
          <dt className="text-muted-foreground">{fr.ticket.domain}</dt>
          <dd>
            <Select value={t.domainId ?? NO_DOMAIN} onValueChange={(v) => void pickDomain(v)}>
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
          </dd>
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
        </dl>
        {failed && (
          <p role="alert" className="px-4 text-sm text-destructive">
            {fr.ticket.domainFailed}
          </p>
        )}
        <section className="grid gap-2 px-4 text-sm">
          <h3 className="font-medium">{fr.ticket.description}</h3>
          <p className="whitespace-pre-wrap text-muted-foreground">{t.description || "-"}</p>
        </section>
        {children.length > 0 && (
          <section className="grid gap-1 px-4 text-sm">
            <h3 className="font-medium">
              {fr.ticket.subtickets} {`${t.progress.done}/${t.progress.total}`}
            </h3>
            {children.map((c) => (
              <p key={c.id}>
                <span className="font-mono text-xs text-muted-foreground">{c.key}</span> {c.title}
              </p>
            ))}
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}
