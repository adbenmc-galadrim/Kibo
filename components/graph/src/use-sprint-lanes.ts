import { useEntities } from "@kibo/sdk";
import { useProject } from "@kibo/sdk/hooks/use-project";
import { useMemo } from "react";
import { type SprintLanesModel, sprintLanes } from "./sprint-lanes";

export function useSprintLanes(): SprintLanesModel {
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const sprints = useEntities("sprint");
  const questions = useEntities("question");
  const today = useProject()?.today ?? null;
  return useMemo(
    () =>
      sprintLanes({
        tickets: tickets.data,
        links: links.data,
        sprints: sprints.data,
        questions: questions.data,
        today,
      }),
    [tickets.data, links.data, sprints.data, questions.data, today],
  );
}
