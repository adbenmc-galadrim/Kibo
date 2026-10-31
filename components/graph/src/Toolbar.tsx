import { Button } from "@kibo/sdk/ui/button";
import { Expand, Shrink } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";
import type { GraphViewKind } from "./graph-view-pref";
import { ViewSwitch } from "./ViewSwitch";

type Fold = { active: boolean; onToggle(): void };

type Props = { view: GraphViewKind; onView(view: GraphViewKind): void; counter: ReactNode; fold?: Fold };

function FoldButton({ fold }: { fold: Fold }) {
  const Icon = fold.active ? Expand : Shrink;
  return (
    <Button
      variant="ghost"
      onClick={fold.onToggle}
      className="h-[26px] shrink-0 gap-1.5 rounded-md border border-(--tracking-border) px-2.5 font-medium text-(--tracking-fg) text-xs [&_svg]:size-[13px]"
    >
      <Icon absoluteStrokeWidth aria-hidden />
      {fold.active ? fr.sprints.unfoldAll : fr.sprints.foldAll}
    </Button>
  );
}

export function Toolbar({ view, onView, counter, fold }: Props) {
  return (
    <div className="flex h-[46px] shrink-0 items-center gap-2 border-(--tracking-soft) border-b px-4">
      <ViewSwitch view={view} onView={onView} />
      <span className="ml-auto truncate text-(--tracking-dim) text-xs">{counter}</span>
      {fold !== undefined && <FoldButton fold={fold} />}
    </div>
  );
}
