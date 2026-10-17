import type { ProjectCommand, ProjectSnapshot } from "@kibo/schema";
import { useMemo } from "react";
import { client } from "../../api";
import { useProjectAgent } from "../../project-agent/use-project-agent";
import { canEdit } from "../../state/access";
import { useNow } from "../../state/use-agents";
import type { SprintDecision } from "./SprintReportBanner";
import { localDay, sprintFeatures, sprintTiming } from "./sprint-facts";
import { pendingSprintActions } from "./sprint-proposal";

export function useSprintView(project: ProjectSnapshot, sprintId: string, fixedNow?: number) {
  const liveNow = useNow(60_000);
  const today = localDay(fixedNow ?? liveNow);
  const projectId = project.meta.id;
  const { view } = useProjectAgent(projectId);
  const sprint = project.sprints.find((s) => s.id === sprintId) ?? null;
  const features = useMemo(() => (sprint ? sprintFeatures(project, sprint) : []), [project, sprint]);
  const proposal = useMemo(
    () => (sprint ? pendingSprintActions(view?.batches ?? [], sprint, project.tickets) : null),
    [view, sprint, project.tickets],
  );
  const command = (cmd: ProjectCommand) => client.rpc({ method: "command", projectId, command: cmd });
  const decide = async (d: SprintDecision) => {
    await client.rpc({ method: "decideBatch", projectId, ...d });
  };
  return {
    sprint,
    features,
    proposal,
    timing: sprint ? sprintTiming(sprint, today) : null,
    editable: canEdit(project),
    command,
    decide,
  };
}
