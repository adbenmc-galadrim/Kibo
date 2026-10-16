import { z } from "zod";
import { NodeId } from "./ids";

export const SprintDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const SprintName = z.string().trim().min(1).max(60);
export const SprintCode = z.string().trim().min(1).max(8);

export const SprintFields = z.object({
  id: NodeId,
  code: SprintCode,
  name: SprintName,
  start: SprintDate,
  end: SprintDate,
});
export const Sprint = SprintFields.refine((s) => s.start <= s.end, {
  message: "end before start",
  path: ["end"],
});
export type Sprint = z.infer<typeof Sprint>;

export const SprintPatch = z
  .object({
    code: SprintCode.optional(),
    name: SprintName.optional(),
    start: SprintDate.optional(),
    end: SprintDate.optional(),
  })
  .strict();
export type SprintPatch = z.infer<typeof SprintPatch>;

export type SprintState = "done" | "current" | "planned";
export type SprintView = Sprint & {
  state: SprintState;
  features: string[];
  delivered: number;
  total: number;
};

export const sprintState = (s: Pick<Sprint, "start" | "end">, today: string): SprintState => {
  if (s.end < today) return "done";
  return s.start <= today ? "current" : "planned";
};

export const sortSprints = <S extends Sprint>(sprints: readonly S[]): S[] =>
  [...sprints].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));

export const currentSprint = <S extends Sprint>(sprints: readonly S[], today: string): S | null =>
  sortSprints(sprints)
    .filter((s) => sprintState(s, today) === "current")
    .at(-1) ?? null;

export const sameSprintCode = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");

export const nextSprint = <S extends Sprint>(sprints: readonly S[], today: string): S | null =>
  sortSprints(sprints).find((s) => sprintState(s, today) === "planned") ?? null;
