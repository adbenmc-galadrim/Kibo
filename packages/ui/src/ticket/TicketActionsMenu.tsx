import type { TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Copy, Ellipsis, FolderInput, Maximize2, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { frHold } from "../i18n/fr-hold";
import { frInbox } from "../i18n/fr-inbox";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { useFlash } from "../lib/use-flash";
import { ConfirmDialog } from "../shell/lazy-dialogs";
import { HoldDialog } from "./HoldDialog";
import { useHoldSuggestions } from "./hold-suggestions";
import { useHold } from "./use-hold";
import { describeTicketError } from "./use-ticket-command";

type Props = {
  projectId: string;
  ticket: TicketView;
  childCount: number;
  editable: boolean;
  onOpenInTab: (() => void) | null;
  onFile?: () => void;
  onDeleted(): void;
  extra?: MenuEntry[];
};

type HoldActions = { hold(): void; resume(): void };

function holdEntry(p: Props, actions: HoldActions): MenuEntry[] {
  const { ticket } = p;
  if (!p.editable || ticket.parentId === null) return [];
  if (ticket.onHold?.source === "own")
    return [{ label: frHold.resume, icon: Play, onSelect: actions.resume }];
  return ticket.statusId === "done" ? [] : [{ label: frHold.menu, icon: Pause, onSelect: actions.hold }];
}

function ticketMenuEntries(p: Props, copy: () => void, remove: () => void, hold: HoldActions): MenuEntry[] {
  const extra = p.extra ?? [];
  const entries: MenuEntry[] = extra.length > 0 ? [...extra, { separator: true }] : [];
  if (p.onOpenInTab) entries.push({ label: t.openInTab, icon: Maximize2, onSelect: p.onOpenInTab });
  entries.push({ label: t.copyKey, icon: Copy, onSelect: copy });
  if (p.onFile) entries.push({ label: frInbox.fileTo, icon: FolderInput, onSelect: p.onFile });
  entries.push(...holdEntry(p, hold));
  if (p.editable)
    entries.push({ separator: true }, { label: t.remove, icon: Trash2, destructive: true, onSelect: remove });
  return entries;
}

function HoldReasonDialog({
  projectId,
  ticket,
  onClose,
}: Pick<Props, "projectId" | "ticket"> & { onClose(): void }) {
  const suggestions = useHoldSuggestions(projectId);
  const command = useHold(projectId, ticket.id);
  const confirm = async (reason: string) => {
    if (await command.hold(reason)) onClose();
  };
  return (
    <HoldDialog
      ticketKey={ticket.keyLabel}
      suggestions={suggestions}
      busy={command.busy}
      error={command.error}
      onConfirm={(reason) => void confirm(reason)}
      onCancel={onClose}
    />
  );
}

export function TicketActionsMenu(p: Props) {
  const [confirming, setConfirming] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdCommand = useHold(p.projectId, p.ticket.id);
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
      {holdCommand.error && (
        <span role="alert" className="text-xs text-destructive">
          {holdCommand.error}
        </span>
      )}
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
          <DropdownMenuEntries
            entries={ticketMenuEntries(p, copy, () => setConfirming(true), {
              hold: () => setHolding(true),
              resume: () => void holdCommand.resume(),
            })}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {holding && (
        <HoldReasonDialog projectId={p.projectId} ticket={p.ticket} onClose={() => setHolding(false)} />
      )}
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
