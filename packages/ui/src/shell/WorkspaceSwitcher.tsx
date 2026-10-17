import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { KiboLogo } from "./KiboLogo";
import { WorkspaceMenuItems } from "./lazy-screens";

export type WorkspaceMenuProps = {
  name: string;
  icon: string | null;
  onSettings(): void;
  onComponents(): void;
  onChanges: (() => void) | null;
};

export function WorkspaceSwitcher({ name, icon, onSettings, onComponents, onChanges }: WorkspaceMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="k-workspace k-focus">
        {icon ? <img src={icon} alt={fr.workspace.iconAlt(name)} /> : <KiboLogo decorative />}
        <span className="truncate">{name}</span>
        <ChevronDown size={13} absoluteStrokeWidth className="k-dim k-13" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {open && (
          <WorkspaceMenuItems
            name={name}
            icon={icon}
            onSettings={onSettings}
            onComponents={onComponents}
            onChanges={onChanges}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
