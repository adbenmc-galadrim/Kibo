import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { usePresenceReporter } from "../state/use-presence";
import { PresenceAvatars } from "./PresenceAvatars";

type Props = {
  project: ProjectSnapshot;
  active: TabTarget | null;
  sheet: { projectId: string; ticketId: string } | null;
};

function ticketOf(projectId: string, active: TabTarget | null, sheet: Props["sheet"]): string | null {
  if (active?.kind === "ticket" && active.projectId === projectId) return active.ticketId;
  return sheet?.projectId === projectId ? sheet.ticketId : null;
}

export function ProjectPresence({ project, active, sheet }: Props) {
  const projectId = project.meta.id;
  usePresenceReporter({
    projectId,
    pageId: active?.kind === "page" && active.projectId === projectId ? active.pageId : null,
    ticketId: ticketOf(projectId, active, sheet),
    shared: project.sync.shared,
  });
  return <PresenceAvatars project={{ id: projectId, name: project.meta.name }} pages={project.pages} />;
}
