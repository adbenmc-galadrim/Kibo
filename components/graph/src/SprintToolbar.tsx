import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Circle, CircleCheck, Package } from "lucide-react";
import type { ComponentProps } from "react";
import { fr } from "./fr";
import { ColumnsMenu } from "./GraphToolbar";
import type { GraphColumns } from "./graph-model";
import { OptionsMenu } from "./OptionsMenu";
import type { SprintLanesModel } from "./sprint-lanes";

export const SPRINT_BUTTON =
  "h-[25px] gap-1.5 rounded-[6px] px-2.5 py-[5px] font-medium text-xs [&_svg:not([class*='size-'])]:size-[13px]";

const FEATURES = "features";
const NONE = "";

type GroupProps = { prefixes: readonly string[]; onGroupBy(prefix: string | null): void };

function GroupMenu({ prefixes, onGroupBy }: GroupProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className={SPRINT_BUTTON}>
          <Package aria-hidden="true" />
          {fr.sprints.groupBy(fr.sprints.groupFeatures)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={FEATURES}
          onValueChange={(v) => v !== FEATURES && onGroupBy(v === NONE ? null : v)}
        >
          <DropdownMenuRadioItem value={FEATURES}>{fr.sprints.groupFeatures}</DropdownMenuRadioItem>
          {prefixes.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              {fr.groupPrefix(p)}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuRadioItem value={NONE}>{fr.sprints.groupNone}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = GroupProps & {
  model: SprintLanesModel;
  collapseDelivered: boolean;
  onToggleCollapse(): void;
  onColumns(columns: GraphColumns): void;
  options: Omit<ComponentProps<typeof OptionsMenu>, "className">;
};

export function SprintToolbar(props: Props) {
  const { model, collapseDelivered } = props;
  const Fold = collapseDelivered ? CircleCheck : Circle;
  return (
    <div className="flex h-[46px] shrink-0 items-center gap-2 border-(--tracking-soft) border-b px-4">
      <GroupMenu prefixes={props.prefixes} onGroupBy={props.onGroupBy} />
      <ColumnsMenu value="sprints" disabled={false} className={SPRINT_BUTTON} onChange={props.onColumns} />
      <Button
        size="sm"
        variant="outline"
        className={SPRINT_BUTTON}
        aria-pressed={collapseDelivered}
        onClick={props.onToggleCollapse}
      >
        <Fold aria-hidden="true" />
        {fr.sprints.collapseDelivered}
      </Button>
      <OptionsMenu {...props.options} className={SPRINT_BUTTON} />
      <span className="ml-auto truncate text-(--tracking-dim) text-xs">
        {fr.sprints.counter(model.features, model.stepLinks, model.featureLinks)}
      </span>
    </div>
  );
}
