import { readProject, trackingMigrationCommands } from "@kibo/core";
import { KiboError } from "@kibo/schema";
import { type Docs, KIBO_COMMAND } from "../docs";
import type { ProjectSettings } from "../notes/settings";

export const TRACKING_MIGRATED_KEY = "trackingMigratedAt";
export const OVERVIEW_MIGRATED_KEY = "overviewMigratedAt";
const MAX_PASSES = 5;

export type TrackingMigrationDeps = {
  docs: Docs;
  settings: Pick<ProjectSettings, "get" | "set">;
  log: (line: string) => void;
  now: () => number;
};

function migrateProject(deps: TrackingMigrationDeps, projectId: string): number {
  const { docs, settings } = deps;
  const planningPage = settings.get(projectId, TRACKING_MIGRATED_KEY) === null;
  const overviewPage = settings.get(projectId, OVERVIEW_MIGRATED_KEY) === null;
  const pending = () =>
    trackingMigrationCommands(readProject(docs.project(projectId), docs.today()), {
      planningPage,
      overviewPage,
    });
  let applied = 0;
  for (let pass = 0, cmds = pending(); cmds.length > 0; pass += 1, cmds = pending()) {
    if (pass === MAX_PASSES)
      throw new KiboError("INTERNAL", `tracking migration of project ${projectId} does not converge`);
    for (const cmd of cmds) docs.run(projectId, cmd, KIBO_COMMAND);
    applied += cmds.length;
  }
  const at = new Date(deps.now()).toISOString();
  if (planningPage) settings.set(projectId, TRACKING_MIGRATED_KEY, at);
  if (overviewPage) settings.set(projectId, OVERVIEW_MIGRATED_KEY, at);
  return applied;
}

export function markMigrated(settings: Pick<ProjectSettings, "set">, projectId: string, at: string): void {
  settings.set(projectId, TRACKING_MIGRATED_KEY, at);
  settings.set(projectId, OVERVIEW_MIGRATED_KEY, at);
}

export function migrateTracking(deps: TrackingMigrationDeps): { migrated: number } {
  let migrated = 0;
  for (const projectId of deps.docs.projectIds()) {
    if (migrateProject(deps, projectId) > 0) migrated += 1;
  }
  return { migrated };
}
