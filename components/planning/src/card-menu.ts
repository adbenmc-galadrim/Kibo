import type { SprintView } from "@kibo/schema";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { CalendarRange } from "lucide-react";
import { fr } from "./fr";
import type { FeatureCard } from "./planning-model";
import { sprintLabel } from "./sprint-label";

export type PlanTarget = { cardId: string; sprintId: string | null };

export function cardEntries(
  card: Pick<FeatureCard, "id" | "sprintId">,
  sprints: readonly SprintView[],
  onPlan: (target: PlanTarget) => void,
): MenuEntry[] {
  const targets = sprints
    .filter((s) => s.id !== card.sprintId)
    .map((s) => ({ label: sprintLabel(s), onSelect: () => onPlan({ cardId: card.id, sprintId: s.id }) }));
  const backlog =
    card.sprintId === null
      ? []
      : [{ label: fr.backlog, onSelect: () => onPlan({ cardId: card.id, sprintId: null }) }];
  return [{ label: fr.planIn, icon: CalendarRange, items: [...targets, ...backlog] }];
}
