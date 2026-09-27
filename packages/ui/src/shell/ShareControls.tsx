import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@kibo/sdk/ui/sidebar";
import { Ellipsis, LogIn, Share2 } from "lucide-react";
import { frShare } from "../i18n/fr-share";
import { useSyncServerStatus } from "../state/use-sync-server";

export function ShareButton({ onShare }: { onShare(): void }) {
  return (
    <Button size="sm" variant="outline" className="h-7" onClick={onShare}>
      <Share2 />
      {frShare.action}
    </Button>
  );
}

type MenuProps = { name: string; current: boolean; shifted: boolean; onShare(): void };

export function ProjectMenu({ name, current, shifted, onShare }: MenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction
          showOnHover={!current}
          className={shifted ? "right-7" : undefined}
          aria-label={frShare.menu(name)}
        >
          <Ellipsis />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem onSelect={onShare}>
          <Share2 />
          {frShare.action}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function JoinProjectEntry({ onJoin }: { onJoin(): void }) {
  const { status } = useSyncServerStatus();
  if (status === null || status.state === "unconfigured") return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={onJoin}>
        <LogIn />
        <span>{frShare.join}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
