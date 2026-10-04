import type { TutorialState } from "@kibo/schema";
import { useRpcQuery } from "../state/use-rpc-query";

const GET_TUTORIAL = { method: "getTutorial" } as const;
const REFRESH_ON = ["tutorial.changed"] as const;

export function useTutorial(): { state: TutorialState | null; refresh(): void } {
  const { data, reload } = useRpcQuery(GET_TUTORIAL, REFRESH_ON);
  return { state: data, refresh: reload };
}

export function tutorialPanelVisible(
  state: TutorialState | null,
  projects: readonly { id: string }[],
): state is TutorialState {
  if (state === null || (state.status !== "active" && state.status !== "done")) return false;
  return projects.some((p) => p.id === state.projectId);
}
