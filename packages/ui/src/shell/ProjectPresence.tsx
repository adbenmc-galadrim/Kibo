import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { usePresenceReporter } from "../state/use-presence";
import { PresenceAvatars } from "./PresenceAvatars";
import { PagePresence } from "./page-actions";

type Props = {
  project: ProjectSnapshot;
  active: TabTarget | null;
  sheet: { projectId: string; ticketId: string } | null;
  avatars: PresencePlace;
};

export type PresencePlace = "inline" | "page" | "none";

function ticketOf(projectId: string, active: TabTarget | null, sheet: Props["sheet"]): string | null {
  if (active?.kind === "ticket" && active.projectId === projectId) return active.ticketId;
  return sheet?.projectId === projectId ? sheet.ticketId : null;
}

export function ProjectPresence({ project, active, sheet, avatars }: Props) {
  const projectId = project.meta.id;
  usePresenceReporter({
    projectId,
    pageId: active?.kind === "page" && active.projectId === projectId ? active.pageId : null,
    ticketId: ticketOf(projectId, active, sheet),
    shared: project.sync.shared,
  });
  if (avatars === "none") return null;
  const list = <PresenceAvatars project={{ id: projectId, name: project.meta.name }} pages={project.pages} />;
  return avatars === "page" ? <PagePresence>{list}</PagePresence> : list;
}
