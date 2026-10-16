import type { SprintView } from "@kibo/schema";

export type CodedSprint = SprintView & { code?: string };

export const sprintCode = (sprint: CodedSprint): string => sprint.code ?? sprint.name;
