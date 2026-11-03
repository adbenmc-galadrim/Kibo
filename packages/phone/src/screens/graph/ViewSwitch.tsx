import type { GraphViewKind } from "@kibo/component-graph/models";
import { GitPullRequest, Package } from "lucide-react";
import { frGraph } from "../../i18n/fr-graph";

const VIEWS = [
  { value: "features", label: frGraph.views.features, Icon: Package },
  { value: "prs", label: frGraph.views.prs, Icon: GitPullRequest },
] as const;

type Props = { view: GraphViewKind; onView(view: GraphViewKind): void };

export function ViewSwitch({ view, onView }: Props) {
  return (
    <fieldset
      aria-label={frGraph.views.label}
      className="m-0 flex h-11 min-w-0 shrink-0 items-center gap-0.5 rounded-[9px] border-0 bg-(--tracking-muted) p-[3px]"
    >
      {VIEWS.map(({ value, label, Icon }) => {
        const on = value === view;
        return (
          <label
            key={value}
            className={`flex h-[38px] items-center gap-2 rounded-[7px] border px-3 font-medium text-[13px] has-focus-visible:ring-2 has-focus-visible:ring-(--tracking-mfg) ${on ? "border-(--tracking-border) bg-(--tracking-bg) text-(--tracking-fg)" : "border-transparent text-(--tracking-mfg)"}`}
          >
            <input
              type="radio"
              name="kibo-phone-graph-view"
              value={value}
              checked={on}
              onChange={() => onView(value)}
              className="sr-only"
            />
            <Icon aria-hidden size={14} absoluteStrokeWidth />
            {label}
          </label>
        );
      })}
    </fieldset>
  );
}
