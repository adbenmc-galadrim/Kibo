import type { ProjectSnapshot } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { fr } from "../i18n/fr";

type Props = { project: ProjectSnapshot; ticketId: string; onClose: () => void };

export function TicketSheet({ project, ticketId, onClose }: Props) {
  const t = project.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  const status = project.workflow.find((s) => s.id === t.statusId)?.label ?? t.statusId;
  const children = project.tickets.filter((x) => x.parentId === t.id);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetDescription className="font-mono">{t.key}</SheetDescription>
          <SheetTitle>{t.title}</SheetTitle>
        </SheetHeader>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 px-4 text-sm">
          <dt className="text-muted-foreground">{fr.ticket.status}</dt>
          <dd>{status}</dd>
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
