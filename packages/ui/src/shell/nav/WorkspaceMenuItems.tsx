import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@kibo/sdk/ui/dropdown-menu";
import { Check, GitCommitHorizontal, Puzzle, Settings } from "lucide-react";
import { fr } from "../../i18n/fr";
import { WorkspaceTile } from "../WorkspaceMark";
import type { WorkspaceMenuProps } from "../WorkspaceSwitcher";

export function WorkspaceMenuItems({ name, icon, onSettings, onComponents, onChanges }: WorkspaceMenuProps) {
  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">{fr.workspace.menu}</DropdownMenuLabel>
      <DropdownMenuItem>
        <WorkspaceTile size="md" src={icon} alt={fr.workspace.iconAlt(name)} />
        <span className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-2xs text-muted-foreground">{fr.workspace.local}</span>
        </span>
        <Check aria-hidden className="ml-auto" />
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onComponents}>
        <Puzzle aria-hidden />
        {fr.nav.components}
      </DropdownMenuItem>
      {onChanges && (
        <DropdownMenuItem onSelect={onChanges}>
          <GitCommitHorizontal aria-hidden />
          {fr.nav.changes}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={onSettings}>
        <Settings aria-hidden />
        {fr.workspace.settings}
      </DropdownMenuItem>
    </>
  );
}
