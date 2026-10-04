import type { TabTarget } from "@kibo/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { useState } from "react";
import { fr } from "../i18n/fr";
import type { HelpDialog } from "./help-dialogs";
import { UserMenuContent } from "./lazy-screens";
import { UserAvatar } from "./UserAvatar";

type Props = { viewer: string; onOpen(target: TabTarget): void; onHelp(key: HelpDialog): void };

export function UserMenu({ viewer, onOpen, onHelp }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={fr.header.userMenu(viewer)}
      >
        <UserAvatar user={viewer} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" aria-label={fr.header.userMenu(viewer)}>
        {open && <UserMenuContent viewer={viewer} onOpen={onOpen} onHelp={onHelp} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
