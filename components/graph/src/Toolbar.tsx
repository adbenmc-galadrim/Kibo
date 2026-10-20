import type { ReactNode } from "react";
import type { GraphViewKind } from "./graph-view-pref";
import { ViewSwitch } from "./ViewSwitch";

type Props = { view: GraphViewKind; onView(view: GraphViewKind): void; counter: ReactNode };

export function Toolbar({ view, onView, counter }: Props) {
  return (
    <div className="flex h-[46px] shrink-0 items-center gap-2 border-(--tracking-soft) border-b px-4">
      <ViewSwitch view={view} onView={onView} />
      <span className="ml-auto truncate text-(--tracking-dim) text-xs">{counter}</span>
    </div>
  );
}
