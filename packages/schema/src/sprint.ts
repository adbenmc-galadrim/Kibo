import { z } from "zod";
import { NodeId } from "./ids";
import { sprintPhase } from "./sprint-phase";

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
  lingering: boolean;
};

export function sprintState(s: Pick<Sprint, "start" | "end">, today: string): SprintState {
  const phase = sprintPhase(s, today);
  if (phase === "ended") return "done";
  return phase === "upcoming" ? "planned" : "current";
}

export const sortSprints = <S extends Sprint>(sprints: readonly S[]): S[] =>
  [...sprints].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));

const lastFinished = <S extends Sprint>(sorted: readonly S[], today: string): S | null =>
  sorted
    .filter((s) => sprintState(s, today) === "done")
    .reduce<S | null>((last, s) => (last === null || s.end >= last.end ? s : last), null);

export function currentSprint<S extends Sprint>(sprints: readonly S[], today: string): S | null {
  const sorted = sortSprints(sprints);
  const running = sorted.filter((s) => sprintState(s, today) === "current").at(-1);
  return running ?? lastFinished(sorted, today);
}

export const isLingering = (
  sprint: Pick<Sprint, "id" | "end">,
  sprints: readonly Sprint[],
  today: string,
): boolean => sprint.end < today && currentSprint(sprints, today)?.id === sprint.id;

export const sameSprintCode = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");

export const nextSprint = <S extends Sprint>(sprints: readonly S[], today: string): S | null =>
  sortSprints(sprints).find((s) => sprintState(s, today) === "planned") ?? null;
