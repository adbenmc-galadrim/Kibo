import type { TabTarget } from "@kibo/schema";
import { hashToTarget, targetToHash } from "../../tabs/target-hash";

export type SprintRoute = { projectId: string; sprintId: string };
type SprintTarget = Extract<TabTarget, { kind: "sprint" }>;

export const sprintTarget = (projectId: string, sprintId: string): SprintTarget => ({
  kind: "sprint",
  projectId,
  sprintId,
});

export const sprintHash = (projectId: string, sprintId: string): string =>
  targetToHash(sprintTarget(projectId, sprintId));

export function parseSprintHash(hash: string): SprintRoute | null {
  const target = hashToTarget(hash);
  return target?.kind === "sprint" ? { projectId: target.projectId, sprintId: target.sprintId } : null;
}
