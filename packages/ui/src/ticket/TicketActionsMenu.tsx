import type { TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Copy, Ellipsis, Maximize2, Trash2 } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { useFlash } from "../lib/use-flash";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { describeTicketError } from "./use-ticket-command";

type Props = {
  projectId: string;
  ticket: TicketView;
  childCount: number;
  editable: boolean;
  onOpenInTab: (() => void) | null;
  onDeleted(): void;
};

export function ticketMenuEntries(p: Props, copy: () => void, remove: () => void): MenuEntry[] {
  const entries: MenuEntry[] = [];
  if (p.onOpenInTab) entries.push({ label: t.openInTab, icon: Maximize2, onSelect: p.onOpenInTab });
  entries.push({ label: t.copyKey, icon: Copy, onSelect: copy });
  if (p.editable)
    entries.push({ separator: true }, { label: t.remove, icon: Trash2, destructive: true, onSelect: remove });
  return entries;
}

export function TicketActionsMenu(p: Props) {
  const [confirming, setConfirming] = useState(false);
  const { message, tone, flash } = useFlash();
  const copy = () => {
    navigator.clipboard.writeText(p.ticket.keyLabel).then(
      () => flash(t.copied),
      () => flash(t.copyFailed, "error"),
    );
  };
  const remove = async () => {
    await client.rpc({
      method: "command",
      projectId: p.projectId,
      command: { method: "deleteTicket", ticketId: p.ticket.id },
    });
    p.onDeleted();
  };
  return (
    <>
      {message && (
        <span
          role={tone === "error" ? "alert" : "status"}
          className={`text-xs ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7" aria-label={t.actions(p.ticket.keyLabel)}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuEntries entries={ticketMenuEntries(p, copy, () => setConfirming(true))} />
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={t.removeTitle(p.ticket.keyLabel)}
          description={t.removeHelp(p.childCount)}
          confirmLabel={t.removeConfirm}
          cancelLabel={t.cancel}
          onConfirm={remove}
          describeError={describeTicketError}
        />
      )}
    </>
  );
}
