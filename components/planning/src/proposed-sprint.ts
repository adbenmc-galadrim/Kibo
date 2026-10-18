import { currentSprint, type SprintView, sortSprints, sprintPhase } from "@kibo/schema";

const isOver = (sprint: SprintView, today: string): boolean => sprintPhase(sprint, today) === "ended";

export function proposedSprint(sprints: readonly SprintView[], today: string): string | null {
  const current = currentSprint(sprints, today);
  if (current !== null && !isOver(current, today)) return current.id;
  return sortSprints(sprints).find((s) => !isOver(s, today))?.id ?? null;
}

export const sprintChoices = (
  sprints: readonly SprintView[],
  today: string,
): { sprint: SprintView; over: boolean }[] =>
  sortSprints(sprints).map((sprint) => ({ sprint, over: isOver(sprint, today) }));
