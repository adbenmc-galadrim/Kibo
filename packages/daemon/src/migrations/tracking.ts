import { getProjectMeta, readProject, trackingMigrationCommands } from "@kibo/core";
import { KiboError } from "@kibo/schema";
import { writable } from "../config/domain-scope-migration";
import { type Docs, KIBO_COMMAND } from "../docs";
import type { ProjectSettings } from "../notes/settings";

export const TRACKING_MIGRATED_KEY = "trackingMigratedAt";
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
  const pending = () =>
    trackingMigrationCommands(readProject(docs.project(projectId), docs.today()), { planningPage });
  let applied = 0;
  for (let pass = 0, cmds = pending(); cmds.length > 0; pass += 1, cmds = pending()) {
    if (pass === MAX_PASSES)
      throw new KiboError("INTERNAL", `tracking migration of project ${projectId} does not converge`);
    for (const cmd of cmds) docs.run(projectId, cmd, KIBO_COMMAND);
    applied += cmds.length;
  }
  if (planningPage) settings.set(projectId, TRACKING_MIGRATED_KEY, new Date(deps.now()).toISOString());
  return applied;
}

export function migrateTracking(deps: TrackingMigrationDeps): { migrated: number; skipped: number } {
  let migrated = 0;
  let skipped = 0;
  for (const projectId of deps.docs.projectIds()) {
    if (!writable(deps.docs, projectId)) {
      skipped += 1;
      deps.log(
        `tracking migration skipped: project "${getProjectMeta(deps.docs.project(projectId)).name}" is read-only`,
      );
      continue;
    }
    if (migrateProject(deps, projectId) > 0) migrated += 1;
  }
  return { migrated, skipped };
}
