import { liveRun, useEntities } from "@kibo/sdk";
import { useMemo } from "react";
import { type SprintLanesModel, sprintLanes } from "./sprint-lanes";

export function useSprintLanes(collapseDelivered: boolean): SprintLanesModel | null {
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const sprints = useEntities("sprint");
  const questions = useEntities("question");
  const runs = useEntities("run");
  const live = useMemo(
    () => new Set(runs.data.filter((r) => liveRun(r) !== null).map((r) => r.ticketId)),
    [runs.data],
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
      }),
    [tickets.data, links.data, sprints.data, questions.data, live, collapseDelivered],
  );
}
