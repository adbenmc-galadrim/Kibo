import { fr } from "./fr";
import type { SprintLanesModel } from "./sprint-lanes";

export const SPRINT_BUTTON =
  "h-[25px] gap-1.5 rounded-[6px] px-2.5 py-[5px] font-medium text-xs [&_svg:not([class*='size-'])]:size-[13px]";

export function SprintToolbar({ model }: { model: SprintLanesModel }) {
  return (
    <div className="flex h-[46px] shrink-0 items-center gap-2 border-(--tracking-soft) border-b px-4">
      <span className="ml-auto truncate text-(--tracking-dim) text-xs">
        {fr.sprints.counter(model.features, model.stepLinks, model.featureLinks)}
      </span>
    </div>
  );
}
