import { Button } from "@kibo/sdk/ui/button";
import { SidebarMenuButton, SidebarMenuItem } from "@kibo/sdk/ui/sidebar";
import { LogIn, Share2 } from "lucide-react";
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
