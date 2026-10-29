import { type SprintView, sameSprintCode } from "@kibo/schema";

type SprintNames = Pick<SprintView, "id" | "code" | "name">;

export function findSprint<S extends SprintNames>(sprints: readonly S[], raw: string): S | null {
  const wanted = raw.trim();
  const folded = wanted.toLowerCase();
  return (
    sprints.find((s) => s.id === wanted) ??
    sprints.find((s) => sameSprintCode(s.code, wanted)) ??
    sprints.find((s) => s.name.toLowerCase() === folded) ??
    null
  );
}
