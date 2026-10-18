import type { ProjectSnapshot } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import { useDaemonOnline } from "../../state/use-agents";
import { SyncLabel } from "../lazy-screens";

export function SyncChip({ project }: { project: ProjectSnapshot | null }) {
  const online = useDaemonOnline();
  if (!online)
    return (
      <span className="k-sync" data-offline="">
        <span>{fr.nav.syncReconnecting}</span>
      </span>
    );
  if (!project?.sync.shared) return null;
  return (
    <span className="k-sync">
      <span>
        <SyncLabel projectId={project.meta.id}>{fr.nav.synced}</SyncLabel>
      </span>
    </span>
  );
}
