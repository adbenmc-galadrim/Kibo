import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Check, ChevronDown, Pencil, Settings } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { RenameWorkspaceDialog } from "./lazy-dialogs";
import { WorkspaceTile } from "./WorkspaceMark";

type Props = { name: string; onRename(name: string): Promise<void>; onSettings(): void };

function WorkspaceLabel({ name }: { name: string }) {
  return (
    <span className="grid min-w-0 flex-1 text-left leading-tight">
      <span className="truncate text-sm font-semibold">{name}</span>
      <span className="truncate text-2xs text-muted-foreground">{fr.workspace.local}</span>
    </span>
  );
}

export function WorkspaceSwitcher({ name, onRename, onSettings }: Props) {
  const [renaming, setRenaming] = useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent">
          <WorkspaceTile size="md" />
          <WorkspaceLabel name={name} />
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{fr.workspace.menu}</DropdownMenuLabel>
          <DropdownMenuItem>
            <WorkspaceTile size="md" />
            <WorkspaceLabel name={name} />
            <Check aria-hidden className="ml-auto" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil aria-hidden />
            {fr.workspace.rename}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSettings}>
            <Settings aria-hidden />
            {fr.workspace.settings}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renaming && (
        <RenameWorkspaceDialog name={name} onSubmit={onRename} onClose={() => setRenaming(false)} />
      )}
    </>
  );
}
