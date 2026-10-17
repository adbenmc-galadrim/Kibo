import { type ProjectSnapshot, splitRef } from "@kibo/schema";

export const OVERVIEW_ID = "overview";

export const overviewMissing = (project: Pick<ProjectSnapshot, "instances">): boolean =>
  !project.instances.some((i) => splitRef(i.component).id === OVERVIEW_ID);
