import { type ProjectSnapshot, splitRef } from "@kibo/schema";

export const PLANNING_ID = "planning";

export const planningMissing = (project: Pick<ProjectSnapshot, "instances">): boolean =>
  !project.instances.some((i) => splitRef(i.component).id === PLANNING_ID);
