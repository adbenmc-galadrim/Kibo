import { liveRun, useEntities } from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { useProject } from "@kibo/sdk/hooks/use-project";
import { useMemo } from "react";
import { type SprintLanesModel, sprintLanes } from "./sprint-lanes";

export function useSprintLanes(collapseDelivered: boolean): SprintLanesModel | null {
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const sprints = useEntities("sprint");
  const questions = useEntities("question");
  const runs = useEntities("run");
  const { agentExecution } = useComponentSettings();
  const shown = agentExecution === "shown";
  const today = useProject()?.today ?? null;
  const live = useMemo(
    () => new Set(shown ? runs.data.filter((r) => liveRun(r) !== null).map((r) => r.ticketId) : []),
    [runs.data, shown],
  );
  return useMemo(
    () =>
      sprintLanes({
        tickets: tickets.data,
        links: links.data,
        sprints: sprints.data,
        questions: questions.data,
        live,
        collapseDelivered,
        today,
      }),
    [tickets.data, links.data, sprints.data, questions.data, live, collapseDelivered, today],
  );
}
