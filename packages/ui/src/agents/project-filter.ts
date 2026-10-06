import type { ProjectSummary, RunView } from "@kibo/schema";

export const PROJECT_ALL = "*";

export const projectRuns = (runs: readonly RunView[], projectId: string | null): RunView[] =>
  projectId === null ? [...runs] : runs.filter((r) => r.projectId === projectId);

export const effectiveProject = (pref: string, projects: readonly ProjectSummary[]): ProjectSummary | null =>
  pref === PROJECT_ALL ? null : (projects.find((p) => p.id === pref) ?? null);
