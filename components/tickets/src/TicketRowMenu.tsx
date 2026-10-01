import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

export function TicketRowMenu({ entries, children }: { entries: MenuEntry[]; children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

type ActionsProps = { entries: MenuEntry[]; label: string; readOnly: boolean };

export function TicketRowActions({ entries, label, readOnly }: ActionsProps) {
  if (readOnly) return <span className="size-6" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
          aria-label={label}
        >
          <Ellipsis className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
