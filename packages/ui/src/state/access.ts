import type { ProjectSnapshot } from "@kibo/schema";

export const canEdit = (project: ProjectSnapshot): boolean => project.sync.access === "write";
