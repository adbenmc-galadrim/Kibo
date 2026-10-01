import type { ProjectSnapshot, ProjectSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Inbox, Plus } from "lucide-react";
import { frInbox as t } from "../i18n/fr-inbox";

export type InboxPageProps = {
  snapshot: ProjectSnapshot | null;
  projects: ProjectSummary[];
  viewer: string;
  onOpenTicket(ticketId: string): void;
  onNewTicket(): void;
};

function EmptyInbox({ onNewTicket }: { onNewTicket(): void }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <Inbox aria-hidden className="size-8 text-muted-foreground" />
      <div className="grid gap-1">
        <p className="text-sm font-medium">{t.empty}</p>
        <p className="text-sm text-muted-foreground">{t.emptyHelp}</p>
      </div>
      <Button variant="outline" onClick={onNewTicket}>
        <Plus aria-hidden />
        {t.newTicket}
      </Button>
    </div>
  );
}

export function InboxPage({ snapshot, onOpenTicket, onNewTicket }: InboxPageProps) {
  const tickets = snapshot?.tickets ?? [];
  return (
    <div className="grid gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-2xl gap-1">
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button onClick={onNewTicket}>
          <Plus aria-hidden />
          {t.newTicket}
        </Button>
      </header>
      {tickets.length === 0 ? (
        <EmptyInbox onNewTicket={onNewTicket} />
      ) : (
        <ul className="grid gap-1.5">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => onOpenTicket(ticket.id)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-left outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="shrink-0 font-mono text-2xs text-muted-foreground">{ticket.keyLabel}</span>
                <span className="truncate text-sm">{ticket.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
