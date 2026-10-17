import { DropdownMenuItem } from "@kibo/sdk/ui/dropdown-menu";
import { LogIn, Plus } from "lucide-react";
import { fr } from "../i18n/fr";
import { frShare } from "../i18n/fr-share";
import { useSyncServerStatus } from "../state/use-sync-server";

type Props = { onNewProject(): void; onJoin(): void };

export function ProjectAddItems({ onNewProject, onJoin }: Props) {
  const { status } = useSyncServerStatus();
  const joinable = status !== null && status.state !== "unconfigured";
  return (
    <>
      <DropdownMenuItem onSelect={onNewProject}>
        <Plus aria-hidden />
        {fr.nav.newProject}
      </DropdownMenuItem>
      {joinable && (
        <DropdownMenuItem onSelect={onJoin}>
          <LogIn aria-hidden />
          {frShare.join}
        </DropdownMenuItem>
      )}
    </>
  );
}
