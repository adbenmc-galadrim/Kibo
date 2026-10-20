import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { GitPullRequest, Package } from "lucide-react";
import { fr } from "./fr";
import type { GraphViewKind } from "./graph-view-pref";

const SEGMENT =
  "h-[21px] min-w-0 gap-1.5 rounded-[5px] border border-transparent px-2.5 font-medium text-(--tracking-mfg) text-[12.5px] shadow-none hover:bg-transparent hover:text-(--tracking-fg) data-[state=on]:border-(--tracking-border) data-[state=on]:bg-(--tracking-bg) data-[state=on]:text-(--tracking-fg) [&_svg:not([class*='size-'])]:size-[13px]";

const VIEWS = [
  { value: "features", label: fr.views.features, Icon: Package },
  { value: "prs", label: fr.views.prs, Icon: GitPullRequest },
] as const;

const isView = (value: string): value is GraphViewKind => VIEWS.some((v) => v.value === value);

type Props = { view: GraphViewKind; onView(view: GraphViewKind): void };

export function ViewSwitch({ view, onView }: Props) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={0.5}
      aria-label={fr.views.label}
      value={view}
      onValueChange={(v) => isView(v) && onView(v)}
      className="shrink-0 rounded-[7px] bg-(--tracking-muted) p-0.5"
    >
      {VIEWS.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} className={SEGMENT}>
          <Icon absoluteStrokeWidth aria-hidden />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
