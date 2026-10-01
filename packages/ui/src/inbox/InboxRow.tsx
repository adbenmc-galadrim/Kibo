import type { Status, TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries } from "@kibo/sdk/ui/menu-entries";
import { TableCell, TableRow } from "@kibo/sdk/ui/table";
import { Ellipsis, FolderInput } from "lucide-react";
import { frInbox as t } from "../i18n/fr-inbox";
import { inboxMenuEntries } from "./inbox-menu";

export type InboxRowProps = {
  ticket: TicketView;
  workflow: readonly Status[];
  onOpen(): void;
  onFile(): void;
  onRemove(): void;
};

const INBOX_CELL = "px-3 py-2";

export function InboxRow({ ticket, workflow, onOpen, onFile, onRemove }: InboxRowProps) {
  const entries = inboxMenuEntries({ texts: t, actions: { open: onOpen, file: onFile, remove: onRemove } });
  const status = workflow.find((s) => s.id === ticket.statusId)?.label ?? ticket.statusId;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow>
          <TableCell className={`${INBOX_CELL} font-mono text-2xs text-muted-foreground`}>
            {ticket.keyLabel}
          </TableCell>
          <TableCell className={`${INBOX_CELL} max-w-0 w-full`}>
            <button
              type="button"
              onClick={onOpen}
              className="block max-w-full truncate rounded-sm text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ticket.title}
            </button>
          </TableCell>
          <TableCell className={INBOX_CELL}>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusDot statusId={ticket.statusId} />
              {status}
            </span>
          </TableCell>
          <TableCell className={`${INBOX_CELL} text-sm text-muted-foreground`}>
            {ticket.assignee?.ref ?? t.nobody}
          </TableCell>
          <TableCell className={`${INBOX_CELL} text-right`}>
            <span className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-7" onClick={onFile}>
                <FolderInput aria-hidden />
                {t.file}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t.actions(ticket.keyLabel)}
                  >
                    <Ellipsis aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuEntries entries={entries} />
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
