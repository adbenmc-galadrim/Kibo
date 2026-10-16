import type { TabTarget } from "@kibo/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import type { HelpDialog } from "./help-dialogs";
import { UserMenuContent } from "./lazy-screens";
import { initials } from "./UserAvatar";

type Props = { viewer: string; onOpen(target: TabTarget): void; onHelp(key: HelpDialog): void };

export function UserMenu({ viewer, onOpen, onHelp }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="k-user k-focus" aria-label={fr.header.userMenu(viewer)}>
        <b aria-hidden>{initials(viewer)}</b>
        <span className="truncate">{viewer}</span>
        <Ellipsis size={14} absoluteStrokeWidth className="k-dim k-14" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64" aria-label={fr.header.userMenu(viewer)}>
        {open && <UserMenuContent viewer={viewer} onOpen={onOpen} onHelp={onHelp} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
