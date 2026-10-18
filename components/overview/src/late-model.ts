import { lateFeatures, type SprintView } from "@kibo/schema";
import { fr } from "./fr";
import { dayMonth, type FeatureFacts } from "./overview-facts";
import { type FeatureLine, lineOf } from "./sprint-model";

export type LateRow = FeatureLine & { sprintCode: string; sprintNote: string; remaining: string };

export function lateRows(input: {
  features: readonly FeatureFacts[];
  sprints: readonly SprintView[];
  blocking: ReadonlyMap<string, string>;
  today: string;
}): LateRow[] {
  const views = input.features.map((f) => ({ ...f, remaining: f.state.remaining }));
  const sprints = new Map(input.sprints.map((s) => [s.id, s]));
  return lateFeatures(views, input.sprints, input.today).map((f) => {
    const sprint: SprintView | undefined = f.sprintId === null ? undefined : sprints.get(f.sprintId);
    return {
      ...lineOf(f, input.blocking),
      sprintCode: sprint?.code ?? "",
      sprintNote: sprint === undefined ? "" : fr.late.ended(dayMonth(sprint.end)),
      remaining: fr.late.remaining(f.remaining),
    };
  });
}
