import { INBOX_ID, type ProjectSnapshot, type ProjectSummary, type TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Inbox, Plus } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frInbox as t } from "../i18n/fr-inbox";
import { frTicketEdit } from "../i18n/fr-ticket-edit";
import { subtreeIds } from "../lib/inbox";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { describeTicketError } from "../ticket/use-ticket-command";
import { InboxRow } from "./InboxRow";

export type InboxPageProps = {
  snapshot: ProjectSnapshot | null;
  projects: ProjectSummary[];
  viewer: string;
  onOpenTicket(ticketId: string): void;
  onNewTicket(): void;
  onFile(ticketId: string): void;
};

const HEAD = "h-9 px-3 text-2xs font-normal text-muted-foreground";

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

function RemoveTicket({
  ticket,
  childCount,
  onClose,
}: {
  ticket: TicketView;
  childCount: number;
  onClose(): void;
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={frTicketEdit.removeTitle(ticket.keyLabel)}
      description={frTicketEdit.removeHelp(childCount)}
      confirmLabel={frTicketEdit.removeConfirm}
      cancelLabel={frTicketEdit.cancel}
      onConfirm={async () => {
        await client.rpc({
          method: "command",
          projectId: INBOX_ID,
          command: { method: "deleteTicket", ticketId: ticket.id },
        });
      }}
      describeError={describeTicketError}
    />
  );
}

export function InboxPage({ snapshot, onOpenTicket, onNewTicket, onFile }: InboxPageProps) {
  const [removing, setRemoving] = useState<TicketView | null>(null);
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
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label={t.title}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${HEAD} w-20`}>{t.columns.key}</TableHead>
                <TableHead className={HEAD}>{t.columns.title}</TableHead>
                <TableHead className={`${HEAD} w-36`}>{t.columns.status}</TableHead>
                <TableHead className={`${HEAD} w-28`}>{t.columns.assignee}</TableHead>
                <TableHead className={`${HEAD} w-40`}>
                  <span className="sr-only">{t.columns.actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <InboxRow
                  key={ticket.id}
                  ticket={ticket}
                  workflow={snapshot?.workflow ?? []}
                  onOpen={() => onOpenTicket(ticket.id)}
                  onFile={() => onFile(ticket.id)}
                  onRemove={() => setRemoving(ticket)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {removing && (
        <RemoveTicket
          ticket={removing}
          childCount={subtreeIds(tickets, removing.id).size - 1}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
