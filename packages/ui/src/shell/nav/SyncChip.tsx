import type { ProjectSnapshot } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import { SyncLabel } from "../lazy-screens";

export function SyncChip({ project }: { project: ProjectSnapshot | null }) {
  if (!project?.sync.shared) return null;
  return (
    <span className="k-sync">
      <span>
        <SyncLabel projectId={project.meta.id}>{fr.nav.synced}</SyncLabel>
      </span>
    </span>
  );
}
