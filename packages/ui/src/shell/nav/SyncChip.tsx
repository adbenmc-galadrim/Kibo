import type { ProjectSnapshot } from "@kibo/schema";
import { fr } from "../../i18n/fr";

export function SyncChip({ project }: { project: ProjectSnapshot | null }) {
  if (!project?.sync.shared) return null;
  return <span className="k-sync">{fr.nav.synced}</span>;
}
