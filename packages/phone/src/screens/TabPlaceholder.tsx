import { manifest as graph } from "@kibo/component-graph";
import { manifest as kanban } from "@kibo/component-kanban";
import { manifest as overview } from "@kibo/component-overview";
import { manifest as planning } from "@kibo/component-planning";
import { manifest as questions } from "@kibo/component-questions";
import type { ComponentManifest } from "@kibo/schema";
import { fr } from "../i18n/fr";
import type { PhoneTab } from "../route";
import { useProjectSnapshot } from "../use-project";

const TAB_COMPONENTS: Record<PhoneTab, ComponentManifest> = {
  graph,
  kanban,
  planning,
  questions,
  dashboard: overview,
};

export function TabPlaceholder({ projectId, tab }: { projectId: string; tab: PhoneTab }) {
  const snapshot = useProjectSnapshot(projectId);
  return (
    <p className="p-4 text-[15px] text-(--tracking-mfg)">
      {snapshot ? fr.tabCount(TAB_COMPONENTS[tab].title, snapshot.tickets.length) : fr.loading}
    </p>
  );
}
