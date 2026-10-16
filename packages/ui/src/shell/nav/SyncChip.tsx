import type { ProjectSnapshot } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import { SyncAge } from "../lazy-screens";

export function SyncChip({ project }: { project: ProjectSnapshot | null }) {
  if (!project?.sync.shared) return null;
  return (
    <span className="k-sync">
      <span>
        {fr.nav.synced}
        <SyncAge projectId={project.meta.id} />
      </span>
    </span>
  );
}
